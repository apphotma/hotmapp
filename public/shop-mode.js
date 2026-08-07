export const setShopModeVisibility = ({ chatAreaEl, shopContainerEl, isActive, isMobile, onEnter, onExit }) => {
  if (!chatAreaEl) return;

  if (isActive) {
    if (!chatAreaEl.classList.contains('shop-mode-active')) {
      chatAreaEl.classList.add('shop-mode-active');
    }
    if (shopContainerEl) {
      shopContainerEl.style.display = 'flex';
    }
    if (typeof onEnter === 'function') {
      onEnter();
    }
  } else {
    chatAreaEl.classList.remove('shop-mode-active');
    if (shopContainerEl) {
      shopContainerEl.style.display = 'none';
    }
    if (typeof onExit === 'function') {
      onExit();
    }
  }

  if (isMobile && typeof onEnter === 'function' && isActive) {
    return;
  }

  if (isMobile && typeof onExit === 'function' && !isActive) {
    return;
  }
};
