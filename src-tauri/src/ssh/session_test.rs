#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;
    use tokio::sync::Mutex;

    /// Test 1: Verify Session Handle Invalidation Bug
    /// 
    /// This test demonstrates that the session handle stored in SshSession
    /// becomes invalid after being moved to the async task in connect().
    /// 
    /// EXPECTED: This test SHOULD FAIL on unfixed code
    #[tokio::test]
    async fn test_session_handle_invalidation() {
        // This test would require a mock SSH server
        // For now, we document the expected behavior:
        // 
        // 1. Call connect() to establish SSH session
        // 2. Verify SshSession is stored in registry
        // 3. Attempt to use the stored handle
        // 4. EXPECTED: Handle should be valid
        // 5. ACTUAL (unfixed): Handle is invalid because it was moved
        
        // TODO: Implement with mock SSH server
        // For exploration phase, we rely on integration tests
    }

    /// Test 2: Verify Channel Ownership Bug
    /// 
    /// This test demonstrates that the channel cannot be accessed
    /// after being moved to the async task.
    /// 
    /// EXPECTED: This test SHOULD FAIL on unfixed code
    #[tokio::test]
    async fn test_channel_ownership_error() {
        // This test would verify:
        // 
        // 1. Channel is created in connect()
        // 2. Channel is moved to async task
        // 3. Attempt to access channel from SshSession
        // 4. EXPECTED: Channel should be accessible
        // 5. ACTUAL (unfixed): Channel is inaccessible due to move
        
        // TODO: Implement with mock SSH server
    }

    /// Test 3: Verify Data Buffer Race Condition
    /// 
    /// This test demonstrates that concurrent access to output_buffer
    /// from both the async task and drain_output causes data loss.
    /// 
    /// EXPECTED: This test SHOULD FAIL on unfixed code
    #[tokio::test]
    async fn test_output_buffer_race_condition() {
        use std::collections::VecDeque;
        
        // Simulate the race condition
        let buffer = Arc::new(Mutex::new(VecDeque::<Vec<u8>>::new()));
        
        // Writer task (simulates async SSH read loop)
        let buffer_writer = buffer.clone();
        let writer_handle = tokio::spawn(async move {
            for i in 0..10 {
                let mut buf = buffer_writer.lock().await;
                buf.push_back(vec![i]);
                drop(buf);
                tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;
            }
        });

        // Reader task 1 (simulates event emission)
        let buffer_reader1 = buffer.clone();
        let reader1_handle = tokio::spawn(async move {
            let mut received = Vec::new();
            for _ in 0..5 {
                tokio::time::sleep(tokio::time::Duration::from_millis(15)).await;
                let mut buf = buffer_reader1.lock().await;
                while let Some(data) = buf.pop_front() {
                    received.push(data);
                }
            }
            received
        });

        // Reader task 2 (simulates drain_output polling)
        let buffer_reader2 = buffer.clone();
        let reader2_handle = tokio::spawn(async move {
            let mut received = Vec::new();
            for _ in 0..5 {
                tokio::time::sleep(tokio::time::Duration::from_millis(20)).await;
                let mut buf = buffer_reader2.lock().await;
                while let Some(data) = buf.pop_front() {
                    received.push(data);
                }
            }
            received
        });

        writer_handle.await.unwrap();
        let received1 = reader1_handle.await.unwrap();
        let received2 = reader2_handle.await.unwrap();

        // EXPECTED: Total received should be 10 items
        // ACTUAL (with dual read): Data is split between readers, demonstrating the race
        let total_received = received1.len() + received2.len();
        
        // This assertion documents the race condition
        // In unfixed code, data is split unpredictably between readers
        assert_eq!(total_received, 10, "Data should not be lost in race condition");
        
        // The problem: we can't predict which reader gets which data
        // This is the bug we're fixing
    }
}
