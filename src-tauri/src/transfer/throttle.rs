use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

/// A token-bucket style bandwidth throttle.
///
/// Callers invoke `acquire(bytes)` before sending/receiving data.
/// The method sleeps just long enough to keep the average throughput
/// at or below the configured limit.
#[derive(Clone)]
pub struct BandwidthThrottle {
    bytes_per_second: Arc<AtomicU64>,
}

impl BandwidthThrottle {
    /// Create a new throttle.
    /// Pass `0` or `u64::MAX` to disable throttling.
    pub fn new(bytes_per_second: u64) -> Self {
        Self {
            bytes_per_second: Arc::new(AtomicU64::new(bytes_per_second)),
        }
    }

    /// Wait long enough to stay within the bandwidth limit.
    ///
    /// If the limit is 0 or `u64::MAX` the call returns immediately.
    pub async fn acquire(&self, bytes: u64) {
        let limit = self.bytes_per_second.load(Ordering::Relaxed);

        // 0 or u64::MAX means unlimited
        if limit == 0 || limit == u64::MAX || bytes == 0 {
            return;
        }

        // How long this chunk *should* take at the target rate.
        // duration = bytes / (bytes_per_second)  →  in microseconds to avoid f64
        let delay_us = (bytes as u128 * 1_000_000u128) / (limit as u128);
        if delay_us == 0 {
            return;
        }

        tokio::time::sleep(std::time::Duration::from_micros(delay_us as u64)).await;
    }

    /// Change the bandwidth limit at runtime.
    pub fn set_limit(&self, bytes_per_second: u64) {
        self.bytes_per_second.store(bytes_per_second, Ordering::Relaxed);
    }

    /// Disable throttling (equivalent to `set_limit(u64::MAX)`).
    pub fn disable(&self) {
        self.bytes_per_second.store(u64::MAX, Ordering::Relaxed);
    }

    /// Return the current limit.
    pub fn get_limit(&self) -> u64 {
        self.bytes_per_second.load(Ordering::Relaxed)
    }
}
