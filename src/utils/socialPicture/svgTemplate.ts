import { createCanvas } from 'canvas';
import { toBase64DataURI } from '.';

import QRCode from 'qrcode';

interface SvgFields {
  background_color: string;
  background_image: string;
  domain: string;
  fontSize: number;
  mimeType?: string;
}

const FontFamily =
  'system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Ubuntu, Helvetica Neue, Oxygen, Cantarell, sans-serif';

export default function svgTemplate({
  background_color,
  background_image,
  domain,
  fontSize,
  mimeType,
}: SvgFields): string {
  const [label, extension] = domain.split('.');
  let shortLabel = '';
  if (label.length > 40) {
    shortLabel = label.substring(0, 40 - 3) + '...';
  }

  return `<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
          <pattern id="backImg" patternUnits="userSpaceOnUse" x="0" y="0" width="512" height="512">
            ${
              background_color
                ? `<rect fill="${background_color}" width="512" height="512"/>`
                : ''
            }
            <image href="data:${
              mimeType ? mimeType : 'image/svg+xml'
            };base64,${background_image}" width="512" height="512" />
          </pattern>
          <filter id="shadowy">
            <feDiffuseLighting in="SourceGraphic" result="light"
                lighting-color="white">
              <feDistantLight azimuth="240" elevation="40"/>
            </feDiffuseLighting>
            <feComposite in="SourceGraphic" in2="light"
                        operator="arithmetic" k1="1" k2="0" k3="0" k4="0"/>
          </filter>
    </defs>
    <rect width="512" height="512" fill="url(#backImg)" filter="url(#shadowy)"/>

    <g transform="scale(1.75) translate(18,21)">
      <path xmlns="http://www.w3.org/2000/svg" d="M0.666687 45.3895L0.670354 45.3867L0.677687 45.3812L0.666687 45.3895L0.68777 45.3739L11.7511 37.0512C11.6953 36.4665 11.6667 35.8739 11.6667 35.2746V20.5619L22.6667 14.493V28.8378L35.5 19.1826V7.41249L48.3333 0.332031V9.52651L59.3333 1.25157V3.09065L48.3333 11.0208V12.515L59.3333 4.92973V6.76881L48.3333 14.0093V15.5035L59.3333 8.60789V10.447L48.3333 16.9978V18.493L59.3333 12.2861V14.1251L48.3333 19.9872V21.4805L59.3333 15.9642V17.8033L48.3333 22.9748V24.469L59.3333 19.6424V21.4815L48.3333 25.9633V35.2746C48.3333 45.4315 40.1252 53.6654 30 53.6654C21.7172 53.6654 14.7173 48.1554 12.4441 40.59L0.67402 45.3858L0.666687 45.3895ZM12.2611 39.9372L0.681354 45.3812L0.67677 45.384L12.3489 40.262C12.3186 40.1541 12.2894 40.0458 12.2611 39.9372ZM11.8688 38.0148L0.68777 45.3739L0.677687 45.3812L11.9194 38.3348C11.9016 38.2284 11.8847 38.1217 11.8688 38.0148ZM12.1059 39.2941L0.69602 45.3739L12.1802 39.6146C12.1545 39.5082 12.1297 39.4013 12.1059 39.2941ZM11.7848 37.3735L0.70152 45.3647L11.824 37.6947C11.81 37.5879 11.7969 37.4808 11.7848 37.3735ZM35.5 31.1936L22.7618 36.3851C23.2864 39.4108 25.9171 41.7113 29.0834 41.7113C32.6272 41.7113 35.5 38.8295 35.5 35.2746V31.1936ZM35.5 29.0088L22.6667 35.0438V35.2746C22.6667 35.4265 22.6719 35.5771 22.6822 35.7264L35.5 30.1012V29.0088ZM35.5 26.8267L22.6667 33.6654V34.3541L35.5 27.9173V26.8267ZM35.5 24.641L22.6667 32.2851V32.9757L35.5 25.7343V24.641ZM35.5 22.4571L22.6667 30.9058V31.5955L35.5 23.5495V22.4571ZM35.5 20.2741L22.6667 29.5274V30.2162L35.5 21.3656V20.2741ZM0.67677 45.384L0.67402 45.3858L0.681354 45.3812L12.0377 38.9736C12.016 38.8672 11.9952 38.7604 11.9754 38.6533L0.677687 45.3812L0.67402 45.3858L0.670354 45.3867L0.67677 45.384Z" fill="white"/>
    </g>
    <g transform="scale(1.75) translate(250, 21)">
      <path xmlns="http://www.w3.org/2000/svg" d="M22 11L19.56 8.21L19.9 4.52L16.29 3.7L14.4 0.5L11 1.96L7.6 0.5L5.71 3.69L2.1 4.5L2.44 8.2L0 11L2.44 13.79L2.1 17.49L5.71 18.31L7.6 21.5L11 20.03L14.4 21.49L16.29 18.3L19.9 17.48L19.56 13.79L22 11ZM9.09 15.72L5.29 11.91L6.77 10.43L9.09 12.76L14.94 6.89L16.42 8.37L9.09 15.72Z" fill="white"/>
    </g>
    <text
      x="35"
      y="430"
      font-size="${fontSize}px"
      font-weight="bold"
      fill="#FFFFFF"
      font-family="${FontFamily}"
      >
        ${shortLabel || label}
    </text>
    <text
      x="35"
      y="480"
      font-size="40px"
      fill="#FFFFFF"
      weight="400"
      font-family="${FontFamily}"
      >
        .${extension}
    </text>
  </svg>`;
}

export const simpleSVGTemplate = (href: string) => `<svg
  width="512"
  height="512"
  viewBox="0 0 512 512"
  fill="none"
  xmlns="http://www.w3.org/2000/svg"
  >
  <image
    href="${href}"
    width="512"
    height="512"
  />
  </svg>
`;

export const metaSVGTemplate = async (
  domain: string,
  exists = true,
  image: string = toBase64DataURI(DEFAULT_META_IMAGE),
  mimeType = 'image/svg+xml',
) => {
  const qrBase64 = await generateQR(domain);
  const fontFamily = 'Helvetica Neue, Helvetica, Arial, sans-serif';
  const [domainName, extension] = domain.split('.'); //@TODO implement domain name shortening up to 14px
  const SIZE = { W: 1200, H: 630 }; // metaimage dimensions
  const IMG_SIZE = 384; // domain image square diminsion in px
  const QR_SIZE = 96; // QR code square dimension in px
  const MAX_TEXT_WIDTH = 260;
  const MAX_FONT_SIZE = 52;
  const mesuredFontSize = getFontSizeToFit(
    domainName,
    fontFamily,
    MAX_TEXT_WIDTH,
  );
  const fontSize =
    mesuredFontSize > MAX_FONT_SIZE ? MAX_FONT_SIZE : mesuredFontSize;
  const background = exists ? '#fbe8f0' : '#dfebff';
  return ` 
    <svg
      width="${SIZE.W}"
      height="${SIZE.H}"
      viewBox="0 0 ${SIZE.W} ${SIZE.H}"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect id="BG" width="${SIZE.W}" height="${SIZE.H}" fill="${background}" />
      <g id="main">
        <svg id="main" x="384" y="39" width="432" height="552">
          <defs>
            <clipPath id="inner-frame">
              <rect width="${IMG_SIZE}" height="${IMG_SIZE}" rx="16" />
            </clipPath>
          </defs>
          <rect id="outer-frame" width="434" height="554" rx="25" fill="#4a3143" />
          <rect id="inner-frame-backfill" x="24" y="24" width="${IMG_SIZE}" height="${IMG_SIZE}" rx="16" fill="#f6f0ec" />
          <foreignObject x="24" y="24" width="${IMG_SIZE}" height="${IMG_SIZE}" clip-path="url(#inner-frame)">
            <div xmlns="http://www.w3.org/1999/xhtml">
              <img
                width="${IMG_SIZE}"
                height="${IMG_SIZE}"
                style="object-fit: cover;"
                src="${image}" />
            </div>
          </foreignObject>
          <rect id="overlay" x="24" y="24" width="${IMG_SIZE}" height="${IMG_SIZE}" rx="16" fill="rgba(0, 0, 0, 0.16)" />
          <text
            id="domain"
            x="24"
            y="432"
            font-size="${fontSize}px"
            font-weight="900"
            fill="#FFFFFF"
            font-family="${fontFamily}"
            dominant-baseline="hanging"
          >
              ${domainName}
          </text>
          <text
            id="extension"
            x="14"
            y="484"
            font-size="44px"
            fill="none"
            font-weight="900"
            font-family="${fontFamily}"
            stroke="#FFFFFF"
            stroke-width="1"
            dominant-baseline="hanging"
          >
              .${extension}
          </text>
          <image id="QR" x="312" y="432" width="${QR_SIZE}" height="${QR_SIZE}" href='${qrBase64}' />
        </svg>
        ${META_LOGO}
      </g>
    </svg>
  `;
};

function getFontSizeToFit(text: string, fontFace: string, maxWidth: number) {
  //@TODO: improve context.measureText() quality (it looks it varies between diff. browsers and Node.js env)
  const canvas = createCanvas(512, 512);
  const ctx = canvas.getContext('2d');
  if (ctx === null) {
    throw "Can't create context";
  }
  ctx.font = `1px ${fontFace}`;
  const result = maxWidth / ctx.measureText(text).width;
  return Math.round(result * 10) / 10; // round to 1 decimal
}

async function generateQR(domain: string) {
  const domainProfileURL = `https://ud.me/${domain}`; //@TODO create separate URLs for staging and prod based on env. conf
  const qrDataURI = await QRCode.toDataURL(domainProfileURL, {
    width: 96,
    color: {
      dark: '#FFF', // white dots
      light: '#0000', // transparent background
    },
    margin: 2,
    // for more options see: https://github.com/soldair/node-qrcode#qr-code-options
  });
  return qrDataURI;
  /*
   * @TODO implement more sofisticated custom QR code design
   *
   * For custom QR code like in mobile (logo inside, circle patternl, circle eyes) qr-code-styling library could be used
   * https://github.com/kozakdenys/qr-code-styling
   * this library is not supported in Node.js (requires canvas and DOM) https://github.com/kozakdenys/qr-code-styling/issues/9
   *
   * Another way to do is to use http call to QR code monkey (used in mobile team)
   * https://www.qrcode-monkey.com/qr-code-api-with-logo/
   *
   */
}
const META_LOGO =
  '<path id="logo" d="M427 135.69L427.004 135.687L427.012 135.68L427 135.69L427.024 135.672L439.47 126.309C439.407 125.651 439.375 124.985 439.375 124.31V107.759L451.75 100.931V117.069L466.188 106.207V92.9655L480.625 85V95.3438L493 86.0345V88.1034L480.625 97.0248V98.7059L493 90.1724V92.2414L480.625 100.387V102.068L493 94.3103V96.3793L480.625 103.749V105.431L493 98.4483V100.517L480.625 107.112V108.792L493 102.586V104.655L480.625 110.473V112.154L493 106.724V108.793L480.625 113.835V124.31C480.625 135.737 471.391 145 460 145C450.682 145 442.807 138.801 440.25 130.29L427.008 135.686L427 135.69ZM440.044 129.556L427.017 135.68L427.011 135.683L440.142 129.921C440.108 129.8 440.076 129.678 440.044 129.556ZM439.602 127.393L427.024 135.672L427.012 135.68L439.659 127.753C439.639 127.633 439.62 127.513 439.602 127.393ZM439.869 128.832L427.033 135.672L439.953 129.193C439.924 129.073 439.896 128.953 439.869 128.832ZM439.508 126.672L427.039 135.662L439.552 127.033C439.536 126.913 439.522 126.792 439.508 126.672ZM466.188 119.719L451.857 125.56C452.447 128.964 455.407 131.552 458.969 131.552C462.956 131.552 466.188 128.31 466.188 124.31V119.719ZM466.188 117.261L451.75 124.051V124.31C451.75 124.481 451.756 124.651 451.768 124.819L466.188 118.49V117.261ZM466.188 114.807L451.75 122.5V123.275L466.188 116.033V114.807ZM466.188 112.348L451.75 120.947V121.724L466.188 113.578V112.348ZM466.188 109.891L451.75 119.396V120.171L466.188 111.12V109.891ZM466.188 107.435L451.75 117.845V118.62L466.188 108.663V107.435ZM427.011 135.683L427.008 135.686L427.017 135.68L439.792 128.472C439.768 128.352 439.745 128.232 439.722 128.111L427.012 135.68L427.008 135.686L427.004 135.687L427.011 135.683Z" fill="white"/>';

const DEFAULT_META_IMAGE = `
<svg fill="none" height="384" viewBox="0 0 384 384" width="384" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <linearGradient id="a" gradientUnits="userSpaceOnUse" x1="192" x2="192" y1="52.3636" y2="194.685"><stop offset="0" stop-color="#fff"/><stop offset=".419681" stop-color="#fff" stop-opacity=".4"/></linearGradient>
  <linearGradient id="b" gradientUnits="userSpaceOnUse" x1="192" x2="192" y1="208.112" y2="559.888"><stop offset="0" stop-color="#fff"/><stop offset=".419681" stop-color="#fff" stop-opacity=".08"/></linearGradient>
  <clipPath id="c"><rect height="384" rx="16" width="384"/></clipPath>
  <g clip-path="url(#c)">
    <path d="m0 0h384v384h-384z" fill="#0d67fe"/>
    <g fill-opacity=".32">
      <ellipse cx="192" cy="123.524" fill="url(#a)" rx="71.1608" ry="71.1608"/>
      <ellipse cx="192" cy="384" fill="url(#b)" rx="175.888" ry="175.888"/>
    </g>
  </g>
</svg>`;
