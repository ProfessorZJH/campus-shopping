let nextLogoUid = 0;

/** 青柠校园品牌图形标志：142° 鲜切青柠绿渐变购物袋 + 青柠果瓣与嫩芽矢量徽标（唯一实例 ID，严格兼容 CSP style-src 'self'）。 */
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
          <linearGradient :id="gradId" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#189249"/>
            <stop offset="100%" stop-color="#147A3C"/>
          </linearGradient>
        </defs>
        <rect width="48" height="48" rx="13" fill="#15803D"/>
        <rect width="48" height="48" rx="13" :fill="'url(#' + gradId + ')'"/>
        <path d="M0 13C0 5.8203 5.8203 0 13 0H35C42.1797 0 48 5.8203 48 13V23C36 27 14 25 0 19V13Z" fill="#22A456" fill-opacity="0.32"/>
        <rect x="0.75" y="0.75" width="46.5" height="46.5" rx="12.25" stroke="#FFFFFF" stroke-opacity="0.22" stroke-width="1.5"/>
        <path d="M18.5 16.5C18.5 13.4624 20.9624 11 24 11C27.0376 11 29.5 13.4624 29.5 16.5" stroke="#FFFFFF" stroke-width="2.6" stroke-linecap="round"/>
        <rect x="12.5" y="16" width="23" height="21.5" rx="6.5" fill="#FFFFFF"/>
        <circle cx="24" cy="26.8" r="6.6" fill="#15803D"/>
        <circle cx="24" cy="26.8" r="4.8" fill="#D9F99D"/>
        <path d="M24 22V31.6M19.2 26.8H28.8M20.6 23.4L27.4 30.2M27.4 23.4L20.6 30.2" stroke="#15803D" stroke-width="1.25" stroke-linecap="round"/>
        <path d="M30.5 11.2C34.2 10.6 37.2 12.6 37.5 16.2C33.9 16.7 30.9 14.8 30.5 11.2Z" fill="#D9F99D"/>
      </svg>
    </span>
  `,
};
