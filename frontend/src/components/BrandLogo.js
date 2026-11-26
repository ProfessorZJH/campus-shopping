let nextLogoUid = 0;

/** 青柠校园 V6 旗舰图形标志：翡翠青柠渐变超椭圆 + 立体雕塑手提袋 + 电光青柠切面轮与嫩叶（唯一实例 ID，严守 CSP style-src 'self'）。 */
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
            <stop offset="0%" stop-color="#0D8A61"/>
            <stop offset="100%" stop-color="#075E41"/>
          </linearGradient>
        </defs>
        <rect width="48" height="48" rx="13" fill="#0A7B56"/>
        <rect width="48" height="48" rx="13" :fill="'url(#' + gradId + ')'"/>
        <path d="M0 13C0 5.8203 5.8203 0 13 0H35C42.1797 0 48 5.8203 48 13V22C36 26.5 14 24.5 0 18.5V13Z" fill="#18B27E" fill-opacity="0.26"/>
        <rect x="0.75" y="0.75" width="46.5" height="46.5" rx="12.25" stroke="#FFFFFF" stroke-opacity="0.28" stroke-width="1.5"/>
        <path d="M18.5 16.8C18.5 13.5968 20.9624 11 24 11C27.0376 11 29.5 13.5968 29.5 16.8" stroke="#FFFFFF" stroke-width="2.6" stroke-linecap="round"/>
        <path d="M13.2 18.8C13.2 17.1431 14.5431 15.8 16.2 15.8H31.8C33.4569 15.8 34.8 17.1431 34.8 18.8L35.6 33.6C35.702 35.4878 34.2007 37.08 32.3098 37.08H15.6902C13.7993 37.08 12.298 35.4878 12.4 33.6L13.2 18.8Z" fill="#FFFFFF"/>
        <circle cx="24" cy="26.6" r="6.8" fill="#0A7B56"/>
        <circle cx="24" cy="26.6" r="5.1" fill="#C8F963"/>
        <path d="M24 21.5V31.7M18.9 26.6H29.1M20.4 23L27.6 30.2M27.6 23L20.4 30.2" stroke="#0A7B56" stroke-width="1.25" stroke-linecap="round"/>
        <circle cx="24" cy="26.6" r="1.15" fill="#0A7B56"/>
        <path d="M30.2 11.2C34.1 10.4 37.3 12.5 37.7 16.3C33.9 17 30.7 14.9 30.2 11.2Z" fill="#C8F963"/>
      </svg>
    </span>
  `,
};
