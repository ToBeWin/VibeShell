// FTP/SFTP 模块
// 封装 suppaftp，专注极低延迟的被动模式连接

use async_std::io::{ReadExt, WriteExt};
use suppaftp::list::File;
use suppaftp::types::FileType;
use suppaftp::AsyncFtpStream;
use std::path::{Path, PathBuf};

pub struct FtpClient {
    stream: AsyncFtpStream,
    pub current_path: String,
}

impl FtpClient {
    /// 建立 FTP 连接，默认使用被动模式 (PASV) 以穿越 NAT
    pub async fn connect(host: &str, port: u16, user: &str, password: &str) -> Result<Self, String> {
        let addr = format!("{}:{}", host, port);
        let mut stream = AsyncFtpStream::connect(&addr)
            .await
            .map_err(|e| format!("FTP Connection failed: {}", e))?;

        stream.login(user, password)
            .await
            .map_err(|e| format!("FTP Login failed: {}", e))?;

        stream.transfer_type(FileType::Binary)
            .await
            .map_err(|e| format!("FTP TYPE failed: {}", e))?;

        Ok(Self {
            stream,
            current_path: "/".to_string(),
        })
    }

    /// 列出当前目录下的文件
    pub async fn list(&mut self, path: Option<&str>) -> Result<Vec<String>, String> {
        let entries = match self.stream.mlsd(path).await {
            Ok(entries) => entries,
            Err(_) => self.stream
                .list(path)
                .await
                .map_err(|e| format!("FTP LIST failed: {}", e))?,
        };

        let mut files = Vec::new();
        for line in entries {
            let parsed = File::from_mlsx_line(&line)
                .or_else(|_| File::from_posix_line(&line))
                .or_else(|_| File::from_dos_line(&line));

            if let Ok(file) = parsed {
                let mut name = file.name().to_string();
                if file.is_directory() && !name.ends_with('/') {
                    name.push('/');
                }
                files.push(name);
            }
        }

        if files.is_empty() {
            let fallback = self.stream.nlst(path)
                .await
                .map_err(|e| format!("FTP LIST failed: {}", e))?;
            files.extend(fallback);
        }

        files.sort();
        Ok(files)
    }

    /// 更改目录，同步内部路径状态（实现 SSH/SFTP 路径联动的基础）
    pub async fn change_dir(&mut self, path: &str) -> Result<(), String> {
        let target = self.resolve_target_path(path);
        self.stream.cwd(&target)
            .await
            .map_err(|e| format!("FTP CWD failed: {}", e))?;
        let pwd = self.stream.pwd()
            .await
            .map_err(|e| format!("FTP PWD failed: {}", e))?;
        self.current_path = pwd;
        Ok(())
    }

    pub async fn read_bytes(&mut self, path: &str) -> Result<Vec<u8>, String> {
        let target = self.resolve_target_path(path);
        let mut stream = self.stream
            .retr_as_stream(&target)
            .await
            .map_err(|e| format!("FTP READ failed: {}", e))?;

        let mut buffer = Vec::new();
        stream.read_to_end(&mut buffer)
            .await
            .map_err(|e| format!("FTP READ failed: {}", e))?;

        self.stream.finalize_retr_stream(stream)
            .await
            .map_err(|e| format!("FTP READ failed: {}", e))?;

        Ok(buffer)
    }

    pub async fn write_bytes(&mut self, path: &str, data: &[u8]) -> Result<(), String> {
        let target = self.resolve_target_path(path);
        let mut stream = self.stream
            .put_with_stream(&target)
            .await
            .map_err(|e| format!("FTP WRITE failed: {}", e))?;

        stream.write_all(data)
            .await
            .map_err(|e| format!("FTP WRITE failed: {}", e))?;

        self.stream.finalize_put_stream(stream)
            .await
            .map_err(|e| format!("FTP WRITE failed: {}", e))?;

        Ok(())
    }

    pub async fn read_file(&mut self, path: &str) -> Result<String, String> {
        let bytes = self.read_bytes(path).await?;
        String::from_utf8(bytes)
            .map_err(|_| "FTP READ failed: remote file is not valid UTF-8 text".to_string())
    }

    pub async fn write_file(&mut self, path: &str, content: &str) -> Result<(), String> {
        self.write_bytes(path, content.as_bytes()).await
    }

    pub async fn create_dir(&mut self, path: &str) -> Result<(), String> {
        let target = self.resolve_target_path(path);
        self.stream.mkdir(&target)
            .await
            .map_err(|e| format!("FTP MKDIR failed: {}", e))
    }

    pub async fn rename_path(&mut self, old_path: &str, new_path: &str) -> Result<(), String> {
        let source = self.resolve_target_path(old_path);
        let target = if new_path.starts_with('/') {
            new_path.to_string()
        } else {
            let parent = parent_path(&source);
            join_remote_path(&parent, new_path)
        };
        self.stream.rename(&source, &target)
            .await
            .map_err(|e| format!("FTP RENAME failed: {}", e))
    }

    pub async fn delete_path(&mut self, path: &str) -> Result<(), String> {
        let target = self.resolve_target_path(path);
        let attempt_dir = self.stream.rmdir(&target).await;
        if attempt_dir.is_ok() {
            return Ok(());
        }
        self.stream.rm(&target)
            .await
            .map_err(|e| format!("FTP DELETE failed: {}", e))
    }

    /// 断开连接
    pub async fn disconnect(mut self) -> Result<(), String> {
        self.stream.quit()
            .await
            .map_err(|e| format!("FTP QUIT failed: {}", e))
    }

    fn resolve_target_path(&self, path: &str) -> String {
        if path == ".." {
            return parent_path(&self.current_path);
        }
        if path.starts_with('/') {
            return path.trim_end_matches('/').to_string().if_empty_then_root();
        }
        join_remote_path(&self.current_path, path)
    }
}

fn join_remote_path(base: &str, child: &str) -> String {
    let base = if base.is_empty() { "/" } else { base };
    if base == "/" {
        format!("/{}", child.trim_matches('/'))
    } else {
        format!("{}/{}", base.trim_end_matches('/'), child.trim_matches('/'))
    }
}

fn parent_path(path: &str) -> String {
    if path.is_empty() || path == "/" {
        return "/".to_string();
    }

    let parent = Path::new(path)
        .parent()
        .unwrap_or_else(|| Path::new("/"));
    normalize_remote_path(parent)
}

fn normalize_remote_path(path: &Path) -> String {
    let buf = PathBuf::from(path);
    let rendered = buf.to_string_lossy().replace('\\', "/");
    if rendered.is_empty() {
        "/".to_string()
    } else {
        rendered
    }
}

trait RootFallback {
    fn if_empty_then_root(self) -> String;
}

impl RootFallback for String {
    fn if_empty_then_root(self) -> String {
        if self.is_empty() { "/".to_string() } else { self }
    }
}

#[cfg(test)]
mod tests {
    use super::{join_remote_path, normalize_remote_path, parent_path};
    use std::path::Path;

    #[test]
    fn join_remote_path_keeps_root_stable() {
        assert_eq!(join_remote_path("/", "notes.txt"), "/notes.txt");
        assert_eq!(join_remote_path("", "notes.txt"), "/notes.txt");
    }

    #[test]
    fn join_remote_path_trims_extra_separators() {
        assert_eq!(join_remote_path("/var/www/", "/html/"), "/var/www/html");
    }

    #[test]
    fn parent_path_never_walks_above_root() {
        assert_eq!(parent_path("/"), "/");
        assert_eq!(parent_path(""), "/");
        assert_eq!(parent_path("/srv"), "/");
        assert_eq!(parent_path("/srv/www"), "/srv");
    }

    #[test]
    fn normalize_remote_path_uses_forward_slashes() {
        assert_eq!(normalize_remote_path(Path::new("/srv/www")), "/srv/www");
    }
}
