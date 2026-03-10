// FTP/SFTP 模块
// 封装 suppaftp，专注极低延迟的被动模式连接

use suppaftp::AsyncFtpStream;

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

        Ok(Self {
            stream,
            current_path: "/".to_string(),
        })
    }

    /// 列出当前目录下的文件
    pub async fn list(&mut self, path: Option<&str>) -> Result<Vec<String>, String> {
        self.stream.nlst(path)
            .await
            .map_err(|e| format!("FTP LIST failed: {}", e))
    }

    /// 更改目录，同步内部路径状态（实现 SSH/SFTP 路径联动的基础）
    pub async fn change_dir(&mut self, path: &str) -> Result<(), String> {
        self.stream.cwd(path)
            .await
            .map_err(|e| format!("FTP CWD failed: {}", e))?;
        self.current_path = path.to_string();
        Ok(())
    }

    /// 断开连接
    pub async fn disconnect(mut self) -> Result<(), String> {
        self.stream.quit()
            .await
            .map_err(|e| format!("FTP QUIT failed: {}", e))
    }
}
