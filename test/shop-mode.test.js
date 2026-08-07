import { jest } from '@jest/globals';
import { setShopModeVisibility } from '../public/shop-mode.js';

const createElementStub = () => {
  const classList = {
    add: jest.fn(),
    remove: jest.fn(),
    contains: jest.fn().mockReturnValue(false),
  };
  return { classList, style: {} };
};

describe('shop mode visibility', () => {
  it('activates the shop view and shows the container', () => {
    const chatAreaEl = createElementStub();
    const shopContainerEl = createElementStub();
    const onEnter = jest.fn();

    setShopModeVisibility({
      chatAreaEl,
      shopContainerEl,
      isActive: true,
      isMobile: true,
      onEnter,
    });

    expect(chatAreaEl.classList.add).toHaveBeenCalledWith('shop-mode-active');
    expect(shopContainerEl.style.display).toBe('flex');
    expect(onEnter).toHaveBeenCalledTimes(1);
  });

  it('deactivates the shop view and hides the container', () => {
    const chatAreaEl = createElementStub();
    const shopContainerEl = createElementStub();
    const onExit = jest.fn();

    setShopModeVisibility({
      chatAreaEl,
      shopContainerEl,
      isActive: false,
      isMobile: true,
      onExit,
    });

    expect(chatAreaEl.classList.remove).toHaveBeenCalledWith('shop-mode-active');
    expect(shopContainerEl.style.display).toBe('none');
    expect(onExit).toHaveBeenCalledTimes(1);
  });
});
