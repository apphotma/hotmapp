import { createChatInitializationGate } from '../public/chat-init-state.js';

describe('chat initialization gate', () => {
  it('waits until initialization is finished before resolving', async () => {
    const gate = createChatInitializationGate();
    let resolved = false;

    gate.begin();
    const waitPromise = gate.wait().then(() => {
      resolved = true;
    });

    await Promise.resolve();
    expect(resolved).toBe(false);

    gate.finish();
    await waitPromise;

    expect(resolved).toBe(true);
  });
});
