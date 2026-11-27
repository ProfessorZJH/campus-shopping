let nextLogoUid = 0;

/** 主题自适应品牌图形标志：通过 CSS 变量色槽自动随 4 套消费端大厂复刻与 3 套后台工作台切换，零内联样式，严守 CSP style-src 'self'。 */
export default {
  name: 'BrandLogo',
  props: {
    size: { type: Number, default: 34 },
  },
  setup() {
    const gradId = `brand-logo-grad-${++nextLogoUid}`;
    return { gradId };
  },
  template: `
    <span class="brand-logo-mark" aria-hidden="true">
      <svg :width="size" :height="size" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient :id="gradId" x1="4" y1="2" x2="44" y2="46" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="var(--logo-from, #FF6E00)" />
            <stop offset="100%" stop-color="var(--logo-to, #FF4000)" />
          </linearGradient>
        </defs>
        <rect width="48" height="48" rx="12" fill="var(--logo-to, #FF4000)" />
        <rect width="48" height="48" rx="12" :fill="'url(#' + gradId + ')'" />
        <path d="M0 12C0 5.37258 5.37258 0 12 0H36C42.6274 0 48 5.37258 48 12V21C35.5 25 14.5 23.5 0 18V12Z" fill="#FFFFFF" fill-opacity="0.14" />
        <rect x="0.75" y="0.75" width="46.5" height="46.5" rx="11.25" stroke="#FFFFFF" stroke-opacity="0.24" stroke-width="1.5" />
        <path d="M18.5 16.6C18.5 13.5072 20.9624 11 24 11C27.0376 11 29.5 13.5072 29.5 16.6" stroke="#FFFFFF" stroke-width="2.6" stroke-linecap="round" />
        <path d="M13.4 18.6C13.4 16.9431 14.7431 15.6 16.4 15.6H31.6C33.2569 15.6 34.6 16.9431 34.6 18.6L35.4 33.4C35.502 35.2878 34.0007 36.88 32.1098 36.88H15.8902C13.9993 36.88 12.498 35.2878 12.6 33.4L13.4 18.6Z" fill="#FFFFFF" />
        <path d="M19.2 25.4C20.5 28.1 22.1 29.4 24 29.4C25.9 29.4 27.5 28.1 28.8 25.4" stroke="var(--logo-to, #FF4000)" stroke-width="2.5" stroke-linecap="round" />
        <circle cx="35.5" cy="12.5" r="3.6" fill="var(--logo-accent, #FFE066)" />
      </svg>
    </span>
  `,
};
