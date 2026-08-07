export const createChatInitializationGate = () => {
  let isInitializing = false;
  let resolveFns = [];

  const begin = () => {
    isInitializing = true;
  };

  const finish = () => {
    isInitializing = false;
    const pending = resolveFns.splice(0);
    pending.forEach(resolve => resolve());
  };

  const wait = () => new Promise(resolve => {
    if (!isInitializing) {
      resolve();
      return;
    }
    resolveFns.push(resolve);
  });

  return { begin, finish, wait, get isInitializing() { return isInitializing; } };
};
