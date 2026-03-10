#![allow(dead_code)]

pub trait VibePlugin: Send + Sync {
    fn name(&self) -> &'static str;
    
    fn on_init(&self) -> Result<(), String> {
        Ok(())
    }
    
    fn on_terminal_output(&self, data: &[u8]) -> Vec<u8> {
        data.to_vec()
    }
    
    fn custom_menu_items(&self) -> Vec<String> {
        vec![]
    }
    
    fn handle_menu_action(&self, _action: &str) {}
}

pub struct PluginManager {
    plugins: Vec<Box<dyn VibePlugin>>,
}

impl PluginManager {
    pub fn new() -> Self {
        Self { plugins: vec![] }
    }

    pub fn register(&mut self, plugin: Box<dyn VibePlugin>) {
        self.plugins.push(plugin);
    }
    
    pub fn process_output(&self, data: &[u8]) -> Vec<u8> {
        let mut current_data = data.to_vec();
        for plugin in &self.plugins {
            current_data = plugin.on_terminal_output(&current_data);
        }
        current_data
    }
}
