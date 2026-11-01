/** Let rendering/input run without the timer throttling applied to background tabs. */
export function yieldToBrowser(): Promise<void> {
  if (typeof MessageChannel === 'undefined') return new Promise(resolve => setTimeout(resolve, 0));
  return new Promise(resolve => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => { channel.port1.close(); channel.port2.close(); resolve(); };
    channel.port2.postMessage(null);
  });
}
