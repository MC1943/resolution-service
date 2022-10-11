import nodeFetch from 'node-fetch';
import { Domain, DomainsResolution } from '../../models';
import { createCanvas } from 'canvas';
import createSVGfromTemplate, { simpleSVGTemplate } from './svgTemplate';
import btoa from 'btoa';
import { env } from '../../env';
import { Storage } from '@google-cloud/storage';
import { fetchTokenMetadata } from '../../controllers/MetaDataController';
import { logger } from '../../logger';
import { convert } from 'convert-svg-to-jpeg';
import puppeteer from 'puppeteer';
import fs from 'fs';
import fileUrl from 'file-url';

const storageOptions = env.CLOUD_STORAGE.API_ENDPOINT_URL
  ? { apiEndpoint: env.CLOUD_STORAGE.API_ENDPOINT_URL } // for development using local emulator
  : {}; // for production
const storage = new Storage(storageOptions);

export const parsePictureRecord = (avatarRecord: string) => {
  const regex =
    /(\d+)\/(erc721|erc1155|cryptopunks):(0x[a-fA-F0-9]{40})\/(\d+)/;
  const matches = regex.exec(avatarRecord);
  if (!matches || matches.length !== 5) {
    throw new Error('Invalid avatar record');
  }
  const [, chainId, nftStandard, contractAddress, tokenId] = matches;

  return { chainId, nftStandard, contractAddress, tokenId };
};

const makeImageLink = (imageUrl: string) => {
  const PINATA_URL = 'https://gateway.pinata.cloud/ipfs/';
  const IPFS_REGEX = /^ipfs:\/\/(ipfs\/)?(.*$)/i;
  const [_url, _prefix, cid] = imageUrl.match(IPFS_REGEX) ?? [];

  if (cid) {
    return `https://ipfs.io/ipfs/${cid}`;
  }

  if (imageUrl.startsWith(PINATA_URL)) {
    return `https://ipfs.io/ipfs/${imageUrl.split(PINATA_URL)[1]}`;
  }

  if (
    imageUrl.includes('api.pudgypenguins.io/penguin/image') &&
    !imageUrl.endsWith('.svg')
  ) {
    return `${imageUrl}.svg`; // Fixes Pudgy Penguins bug, images missing .svg at the end
  }

  return imageUrl;
};

export const getNFTSocialPicture = async (
  pictureOrUrl: string,
): Promise<[string, string | null]> => {
  if (pictureOrUrl.startsWith('data:')) {
    const mimeType = pictureOrUrl.substring(
      pictureOrUrl.indexOf(':') + 1,
      pictureOrUrl.indexOf(';'),
    );
    const base64 = pictureOrUrl.substring(pictureOrUrl.indexOf('base64,') + 7);
    return [base64, mimeType];
  }

  const NFP_FETCHING_TIMEOUT = 5000; // in ms
  const resp = await nodeFetch(makeImageLink(pictureOrUrl), {
    timeout: NFP_FETCHING_TIMEOUT,
  });
  if (!resp.ok) {
    throw new Error('Failed to fetch NFT image');
  }
  const data = await resp.buffer();
  const mimeType = resp.headers.get('Content-Type');
  const base64 = data.toString('base64');

  return [base64, mimeType];
};

const getFontSize = (name: string): number => {
  const [label] = name.split('.');
  const canvas = createCanvas(512, 512);
  const ctx = canvas.getContext('2d');
  ctx.font = '18px Arial';
  const text = ctx.measureText(label);
  const fontSize = Math.floor(20 * ((360 - label.length) / text.width));

  if (fontSize > 58) {
    return 54;
  }

  if (fontSize < 21) {
    return 21;
  }

  return fontSize;
};

export const createSocialPictureImage = (
  domain: Domain,
  data: string,
  mimeType: string | null,
  backgroundColor: string,
  raw = false,
): string => {
  const fontSize = getFontSize(
    domain.name.split('.')[0].length > 45
      ? domain.name.substring(0, 45)
      : domain.name,
  );
  const svg = createSVGfromTemplate({
    background_color: backgroundColor,
    background_image: data,
    domain: domain.name,
    fontSize,
    mimeType: mimeType || undefined,
  });

  if (raw) {
    return svg;
  }

  try {
    return toBase64DataURI(svg);
  } catch (e) {
    console.log(e);
    return '';
  }
};

export const getNFTFilenameInCDN = (
  socialPic: string,
  domainToOverlay?: string,
): string => {
  const { chainId, nftStandard, contractAddress, tokenId } =
    parsePictureRecord(socialPic);
  const nftPfpFolder = 'nft-pfp';
  const isDomainNotEmpty = Boolean(domainToOverlay?.trim());
  const overlayPostfix = isDomainNotEmpty ? `_o_${domainToOverlay}` : '';
  return `${nftPfpFolder}/${chainId}_${nftStandard}:${contractAddress}_${tokenId}${overlayPostfix}.svg`;
};

export const cacheSocialPictureInCDN = async (
  socialPic: string,
  domain: Domain,
  resolution: DomainsResolution,
): Promise<void> => {
  if (!isNotEmpty(socialPic)) {
    logger.warn(
      'trying to cache NFT picture with empty token URI, domain:',
      domain?.name,
    );
    return;
  }
  const fileName = getNFTFilenameInCDN(socialPic);
  const fileNameWithOverlay = getNFTFilenameInCDN(socialPic, domain.name);
  const fileNameJpeg = getNFTFilenameInCDN(socialPic)?.replace('.svg', '.jpg'); // dirty hack, pass param instead
  const fileNameWithOverlayJpeg = getNFTFilenameInCDN(
    socialPic,
    domain.name,
  )?.replace('.svg', '.jpg');
  const bucketName = env.CLOUD_STORAGE.CLIENT_ASSETS.BUCKET_ID;
  const bucket = storage.bucket(bucketName);

  const { chainId, nftStandard, contractAddress, tokenId } =
    parsePictureRecord(socialPic);
  const filePrefix = `${chainId}_${nftStandard}:${contractAddress}_${tokenId}`;

  const [files] = await bucket.getFiles({
    prefix: filePrefix,
  });

  const fileNames = files.map((file) => file.name);

  const fileExists = fileNames.indexOf(fileName) >= 0;
  const fileWithOverlayExists = fileNames.indexOf(fileNameWithOverlay) >= 0;
  const fileJpegExists = fileNames.indexOf(fileNameJpeg) >= 0;
  const fileWithOverlayJpegExists =
    fileNames.indexOf(fileNameWithOverlayJpeg) >= 0;

  if (
    !fileExists ||
    !fileWithOverlayExists ||
    fileJpegExists ||
    fileWithOverlayJpegExists
  ) {
    const { fetchedMetadata, image } = await fetchTokenMetadata(resolution);
    const [imageData, mimeType] = await getNFTSocialPicture(image).catch(() => [
      '',
      null,
    ]);

    // upload images to bucket
    if (imageData) {
      type ImageFile = { fname: string; data: string; shouldConvert?: boolean };
      const files: Array<ImageFile> = [];

      if (!fileExists) {
        const imageDataSVG = simpleSVGTemplate(
          `data:${mimeType};base64,${imageData}`,
        );
        files.push({ fname: fileName, data: imageDataSVG });
      }

      if (!fileWithOverlayExists) {
        const withOverlayImageData = createSocialPictureImage(
          domain,
          imageData,
          mimeType,
          fetchedMetadata?.background_color || '',
          true,
        );
        files.push({ fname: fileNameWithOverlay, data: withOverlayImageData });
      }

      if (!fileJpegExists) {
        // could reuse some code?
        const imageDataSVG = simpleSVGTemplate(
          `data:${mimeType};base64,${imageData}`,
        );
        files.push({
          fname: fileNameJpeg,
          data: imageDataSVG,
          shouldConvert: true,
        });
      }

      if (!fileWithOverlayJpegExists) {
        // could reuse some code?
        const withOverlayImageData = createSocialPictureImage(
          domain,
          imageData,
          mimeType,
          fetchedMetadata?.background_color || '',
          true,
        );
        files.push({
          fname: fileNameWithOverlayJpeg,
          data: withOverlayImageData,
          shouldConvert: true,
        });
      }

      await Promise.all(
        files.map(async ({ fname, data, shouldConvert }) => {
          const SVGstring = data;
          console.log('SVGstring=' + SVGstring);
          if (shouldConvert) {
            const args = [
              '--no-sandbox',
              '--disable-setuid-sandbox',
              '--disable-gpu',
              '--disable-dev-shm-usage',
              '--no-first-run',
              '--no-zygote',
              '--single-process',
              "--proxy-server='direct://'",
              '--proxy-bypass-list=*',
              '--deterministic-fetch',
            ];
            console.log('puppeteer args=' + args);

            const html = `<!DOCTYPE html>
                <html>
                <head>
                <meta charset="utf-8">
                <style>
                * { margin: 0; padding: 0; }
                html { background-color: black; }
                </style>
                </head>
                <body>${SVGstring}</body>
                </html>`;

            fs.writeFile('the_html.html', html, function (err: any) {
              console.log(err);
            });

            const browser = await puppeteer.launch({
              executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
              args: args,
              dumpio: true,
            });
            console.log('puppeteer launch finished');

            const theurl = fileUrl('the_html.html');
            console.log('theurl=' + theurl);

            const page = await browser.newPage();
            console.log('opened new page');

            //will need to determine size;
            await page.setViewport({
              width: 1500,
              height: 1500,
              deviceScaleFactor: 1,
            });

            await page.goto(theurl);
            const type = 'jpeg';
            const theEncoding = 'base64';
            //for options see https://pptr.dev/api/puppeteer.page.screenshot
            const dataJPG = await page.screenshot({
              type: type,
              encoding: theEncoding,
              omitBackground: true,
            });
            browser.close();
            /*
            //i dont know why this doesnt work; tpj 10/10/2022 15:30
            //const dataJPG = await convert(SVGstring, {
              //args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
              //dumpio: true,
            //});
            //return res.end(dataJPG, 'binary');
            */

            // NB: conversion of JPEG and PNG to SVG and then back to JPEG might not be optimal.
            /*
            const dataJPG = await convert(data, {
              //can be controlled by ENV variable PUPPETEER_EXECUTABLE_PATH
              //proper value is /usr/bin/chromium-browser
              //executablePath: '/usr/bin/chromium-browser',
              //TODO make this work without --no-sandbox
              //Running without a sandbox is strongly discouraged
              // https://github.com/puppeteer/puppeteer/blob/main/docs/troubleshooting.md#setting-up-chrome-linux-sandbox
              args: ['--no-sandbox', '--disable-dev-shm-usage'],
            }); // @TODO: increase resolution to 1024x1024
            */
            return uploadPicture(fname, dataJPG);
          } else {
            return uploadPicture(fname, data);
          }
        }),
      );
    } else {
      logger.error(
        `Failed to generate image data for the domain: ${domain}, token URI: ${socialPic}`,
      );
    }
  }

  async function uploadPicture(fileName: string, imageData: string | Buffer) {
    const file = bucket.file(fileName);
    // cache in the storage
    const imageBuffer = Buffer.from(imageData);
    const contentType = fileName?.endsWith('.jpg')
      ? 'image/jpeg'
      : 'image/svg+xml';
    await file.save(imageBuffer, {
      metadata: {
        contentType: contentType,
      },
    });
  }
};

function getNFTPictureFname(
  socialPicTokenURI: string,
  withOverlayDomain?: string,
  rasterized?: boolean,
) {
  const aFileName = getNFTFilenameInCDN(socialPicTokenURI, withOverlayDomain);
  return rasterized ? aFileName.replace('.svg', '.jpg') : aFileName;
}

/**
 * Returns a social picture data string cached in CDN or null if image is not found in CDN cache.
 */
export const getNftPfpImageFromCDN = async (
  socialPicTokenURI: string,
  withOverlayDomain?: string,
  rasterized?: boolean,
): Promise<string | null> => {
  if (!isNotEmpty(socialPicTokenURI)) {
    return null;
  }
  const fileName = getNFTPictureFname(
    socialPicTokenURI,
    withOverlayDomain,
    rasterized,
  );
  const bucketName = env.CLOUD_STORAGE.CLIENT_ASSETS.BUCKET_ID;
  const bucket = storage.bucket(bucketName);

  const [fileExists] = await bucket.file(fileName).exists();
  if (fileExists) {
    const contents = await bucket.file(fileName).download();
    return contents.toString(); // maybe replace this with stream buffer in the future
  } else {
    return null;
  }
};

export const getNftPfpImagePathFromCDN = async (
  socialPicTokenURI: string,
  withOverlayDomain?: string,
  rasterized?: boolean,
): Promise<string | null> => {
  if (!isNotEmpty(socialPicTokenURI)) {
    return null;
  }
  const fileName = getNFTPictureFname(
    socialPicTokenURI,
    withOverlayDomain,
    rasterized,
  );
  const bucketName = env.CLOUD_STORAGE.CLIENT_ASSETS.BUCKET_ID;
  const bucket = storage.bucket(bucketName);

  const [fileExists] = await bucket.file(fileName).exists();
  const hostname =
    env.CLOUD_STORAGE.API_ENDPOINT_URL || 'https://storage.googleapis.com';
  return fileExists ? `${hostname}/${bucketName}/${fileName}` : null;
};

export const toBase64DataURI = (svg: string): string => {
  // maybe use Buffer.from(data).toString('base64') instead of btoa(), which is deprecated in nodejs
  return (
    'data:image/svg+xml;base64,' +
    btoa(
      encodeURIComponent(svg).replace(/%([0-9A-F]{2})/g, function (match, p1) {
        return String.fromCharCode(parseInt(p1, 16));
      }),
    )
  );
};

const isNotEmpty = (str: string) => {
  return Boolean(str?.trim());
};

export type PfpNftParams = {
  socialPicture: string;
  domain: Domain;
  resolution: DomainsResolution;
  withOverlay: boolean;
  rasterize: boolean;
};
