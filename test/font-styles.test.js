import { FONT_STYLES, DEFAULT_FONT_STYLE, getFontStyleConfig } from '../public/chat-font-styles.js';

describe('Chat font styles configuration', () => {
  it('defines the default font style', () => {
    expect(DEFAULT_FONT_STYLE).toBe('default');
    expect(FONT_STYLES.default).toBeDefined();
    expect(FONT_STYLES.default.family).toContain('Inter');
  });

  it('provides getFontStyleConfig with graceful fallback', () => {
    expect(getFontStyleConfig('poppins').family).toContain('Poppins');
    expect(getFontStyleConfig('nonexistent').id).toBe('default');
    expect(getFontStyleConfig(null).id).toBe('default');
  });

  it('contains all supported font styles with valid families', () => {
    const expectedStyles = [
      'default',
      'poppins',
      'roboto',
      'montserrat',
      'open-sans',
      'playfair',
      'lora',
      'caveat',
      'dancing-script',
      'comic-neue',
      'fira-code'
    ];

    expectedStyles.forEach(styleKey => {
      expect(FONT_STYLES[styleKey]).toBeDefined();
      expect(FONT_STYLES[styleKey].id).toBe(styleKey);
      expect(typeof FONT_STYLES[styleKey].name).toBe('string');
      expect(typeof FONT_STYLES[styleKey].family).toBe('string');
      expect(FONT_STYLES[styleKey].family.length).toBeGreaterThan(0);
    });
  });

  it('ensures each style has distinct and appropriate families', () => {
    expect(FONT_STYLES['poppins'].family).toContain('Poppins');
    expect(FONT_STYLES['roboto'].family).toContain('Roboto');
    expect(FONT_STYLES['montserrat'].family).toContain('Montserrat');
    expect(FONT_STYLES['open-sans'].family).toContain('Open Sans');
    expect(FONT_STYLES['playfair'].family).toContain('Playfair Display');
    expect(FONT_STYLES['lora'].family).toContain('Lora');
    expect(FONT_STYLES['caveat'].family).toContain('Caveat');
    expect(FONT_STYLES['dancing-script'].family).toContain('Dancing Script');
    expect(FONT_STYLES['comic-neue'].family).toContain('Comic Neue');
    expect(FONT_STYLES['fira-code'].family).toContain('Fira Code');
  });
});
