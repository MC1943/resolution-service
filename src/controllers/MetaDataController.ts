import {
  Controller,
  Get,
  Header,
  Param,
  QueryParam,
} from 'routing-controllers';
import Moralis from 'moralis/node';
import { ResponseSchema } from 'routing-controllers-openapi';
import fetch from 'node-fetch';
import AnimalDomainHelper, {
  OpenSeaMetadataAttribute,
} from '../utils/AnimalDomainHelper/AnimalDomainHelper';
import {
  BackgroundColor,
  DefaultImageData,
  DeprecatedBackgroundColor,
} from '../utils/generalImage';
import {
  MetadataImageFontSize,
  UnstoppableDomainTld,
  UnstoppableDomainTlds,
} from '../types/common';
import { pathThatSvg } from 'path-that-svg';
import { IsArray, IsObject, IsOptional, IsString } from 'class-validator';
import { env } from '../env';
import { logger } from '../logger';
import {
  parsePictureRecord,
  getNftPfpImageFromCDN,
  toBase64DataURI,
  cacheSocialPictureInCDN,
  getNFTSocialPicture,
} from '../utils/socialPicture';
import { getDomainResolution } from '../services/Resolution';
import {
  CustomImageDomains,
  getAttributeCharacterSet,
  getAttributeCategory,
  getAttributeType,
  DomainAttributeTrait,
  AttributeCharacterSet,
  AttributePictureType,
} from '../utils/metadata';
import { Domain, DomainsResolution } from '../models';
import { OpenSeaPort, Network } from 'opensea-js';
import { EthereumProvider } from '../workers/EthereumProvider';
import { belongsToTld, findDomainByNameOrToken } from '../utils/domain';
import { metaSVGTemplate } from '../utils/socialPicture/svgTemplate';

const DEFAULT_IMAGE_URL = (name: string) =>
  `https://metadata.unstoppabledomains.com/image-src/${name}.svg` as const;
const BASE_IMAGE_URL =
  `${env.APPLICATION.ERC721_METADATA.GOOGLE_CLOUD_STORAGE_BASE_URL}/images` as const;
const INVALID_DOMAIN_IMAGE_URL =
  `${env.APPLICATION.ERC721_METADATA.GOOGLE_CLOUD_STORAGE_BASE_URL}/images/invalid-domain.svg` as const;

export enum SupportedL2Chain {
  Polygon = 'polygon',
  Binance = 'bsc',
  Avalanche = 'avalanche',
  Fantom = 'fantom',
}
export enum NetworkId {
  Polygon = '137',
  Binance = '56',
  Avalanche = '43114',
  Fantom = '250',
}

const getChainName = (chainId: string): SupportedL2Chain | 'eth' => {
  switch (chainId) {
    case NetworkId.Polygon:
      return SupportedL2Chain.Polygon;
    case NetworkId.Binance:
      return SupportedL2Chain.Binance;
    case NetworkId.Avalanche:
      return SupportedL2Chain.Avalanche;
    case NetworkId.Fantom:
      return SupportedL2Chain.Fantom;
    default:
      return 'eth';
  }
};

let isMoralisInitialized = false;
const initMoralisSdk = async (): Promise<typeof Moralis> => {
  if (isMoralisInitialized) {
    return Moralis;
  }

  const serverUrl = env.MORALIS.API_URL;
  const appId = env.MORALIS.APP_ID;
  await Moralis.start({ serverUrl, appId });
  isMoralisInitialized = true;
  return Moralis;
};

let openSeaSDK: OpenSeaPort | undefined;
const initOpenSeaSdk = (): OpenSeaPort => {
  if (openSeaSDK) {
    return openSeaSDK;
  }

  openSeaSDK = new OpenSeaPort(EthereumProvider, {
    networkName: Network.Main,
    apiKey: env.OPENSEA.API_KEY,
  });

  return openSeaSDK;
};

const AnimalHelper: AnimalDomainHelper = new AnimalDomainHelper();

type DomainProperties = {
  records: Record<string, string>;
};

class Erc721Metadata {
  @IsString()
  name: string | null;

  @IsString()
  description: string | null;

  @IsString()
  image: string | null;

  @IsString()
  external_url: string | null;
}

class OpenSeaMetadata extends Erc721Metadata {
  @IsOptional()
  @IsString()
  external_link?: string;

  @IsOptional()
  @IsString()
  image_url?: string;

  @IsOptional()
  @IsString()
  image_data?: string | null;

  @IsObject()
  properties: DomainProperties;

  @IsArray()
  attributes: Array<OpenSeaMetadataAttribute>;

  @IsOptional()
  @IsString()
  background_color?: string;

  @IsOptional()
  @IsString()
  animation_url?: string;

  @IsOptional()
  @IsString()
  youtube_url?: string;
}

class TokenMetadata {
  @IsObject()
  fetchedMetadata: {
    name: string;
    token_uri?: string;
    metadata?: string;
    image?: string;
    background_color?: string;
  };

  @IsString()
  image: string;
}

class ImageResponse {
  @IsOptional()
  @IsString()
  image?: string | null;

  @IsString()
  image_data: string;
}

@Controller()
export class MetaDataController {
  @Get('/deaddata/:domainOrToken')
  @ResponseSchema(OpenSeaMetadata)
  async getDeadData(): Promise<{
    name: string;
    description: string;
    image: string;
    background_color: string;
  }> {
    const description = 'This domain is invalid';

    return {
      name: 'INVALID DOMAIN',
      description,
      image: INVALID_DOMAIN_IMAGE_URL,
      background_color: 'FFFFFF',
    };
  }

  @Get('/metadata/:domainOrToken')
  @ResponseSchema(OpenSeaMetadata)
  async getMetaData(
    @Param('domainOrToken') domainOrToken: string,
    @QueryParam('withOverlay') withOverlay = true,
  ): Promise<OpenSeaMetadata> {
    const domain = await findDomainByNameOrToken(domainOrToken);
    if (!domain) {
      return this.defaultMetaResponse(domainOrToken);
    }
    const resolution = getDomainResolution(domain);

    const socialPictureValue = belongsToTld(
      domain.name,
      UnstoppableDomainTlds.Coin,
    )
      ? ''
      : resolution.resolution['social.picture.value'];
    const socialPicture =
      socialPictureValue &&
      (await getNftPfpImageFromCDN(
        socialPictureValue,
        withOverlay ? domain.name : undefined,
      ));

    // we consider that NFT picture is verified if the picture is present in our CDN cache.
    // It means it was verified before caching.
    const isSocialPictureVerified = Boolean(socialPicture);

    const description = this.getDomainDescription(
      domain.name,
      resolution.resolution,
    );
    const DomainAttributeTrait = this.getAttributeType(domain, {
      verifiedNftPicture: isSocialPictureVerified,
    });

    const metadata: OpenSeaMetadata = {
      name: domain.name,
      description,
      properties: {
        records: resolution.resolution,
      },
      external_url: `https://unstoppabledomains.com/search?searchTerm=${domain.name}`,
      image: socialPicture
        ? toBase64DataURI(socialPicture)
        : this.generateDomainImageUrl(domain.name),
      image_url: this.generateDomainImageUrl(domain.name),
      attributes: DomainAttributeTrait,
    };

    if (!this.isDomainWithCustomImage(domain.name) && !socialPicture) {
      const imageDataSvgXml = await this.generateImageData(
        domain.name,
        resolution.resolution,
      );
      metadata.image_data = toBase64DataURI(imageDataSvgXml);
      metadata.background_color = belongsToTld(
        domain.name,
        UnstoppableDomainTlds.Coin,
      )
        ? DeprecatedBackgroundColor
        : BackgroundColor;
    }

    return metadata;
  }

  @Get('/image/:domainOrToken')
  @ResponseSchema(ImageResponse)
  async getImage(
    @Param('domainOrToken') domainOrToken: string,
    @QueryParam('withOverlay') withOverlay = true,
  ): Promise<ImageResponse> {
    const domain = await findDomainByNameOrToken(domainOrToken);
    const resolution = domain ? getDomainResolution(domain) : undefined;
    const name = domain ? domain.name : domainOrToken;

    if (!name.includes('.')) {
      return { image_data: '' };
    }

    if (
      domain &&
      resolution &&
      !belongsToTld(domain.name, UnstoppableDomainTlds.Coin)
    ) {
      const socialPictureValue = resolution.resolution['social.picture.value'];
      const pfpImageFromCDN =
        socialPictureValue &&
        (await getOrCacheNowPfpNFT(
          socialPictureValue,
          domain,
          resolution,
          withOverlay ? ImageType.WithOverlay : ImageType.Simple,
        ));

      return {
        image_data:
          pfpImageFromCDN ||
          (await this.generateImageData(name, resolution?.resolution || {})),
      };
    }

    return {
      image_data: await this.generateImageData(
        name,
        resolution?.resolution || {},
      ),
    };
  }

  @Get('/metaimage-src/:domainOrToken')
  @Header('Access-Control-Allow-Origin', '*')
  @Header('Content-Type', 'image/svg+xml')
  async getImageMetaSrc(
    @Param('domainOrToken') domainOrToken: string,
  ): Promise<string> {
    const domain = await findDomainByNameOrToken(
      domainOrToken.replace('.svg', ''),
    );
    const resolution = domain ? getDomainResolution(domain) : undefined;
    const name = domain ? domain.name : domainOrToken.replace('.svg', '');

    if (!name.includes('.')) {
      return '';
    }

    if (domain && resolution) {
      const socialPictureValue = resolution.resolution['social.picture.value'];

      const metaImageFromCDN =
        socialPictureValue &&
        (await getOrCacheNowPfpNFT(
          socialPictureValue,
          domain,
          resolution,
          ImageType.MetaImage,
        ));

      return metaImageFromCDN || metaSVGTemplate(name, false);
    }

    return metaSVGTemplate(name, false); //non existent domain
  }

  @Get('/image-src/:domainOrToken')
  @Header('Access-Control-Allow-Origin', '*')
  @Header('Content-Type', 'image/svg+xml')
  async getImageSrc(
    @Param('domainOrToken') domainOrToken: string,
    @QueryParam('withOverlay') withOverlay = true,
  ): Promise<string> {
    const domain = await findDomainByNameOrToken(
      domainOrToken.replace('.svg', ''),
    );
    const resolution = domain ? getDomainResolution(domain) : undefined;
    const name = domain ? domain.name : domainOrToken.replace('.svg', '');

    if (!name.includes('.')) {
      return '';
    }

    if (
      domain &&
      resolution &&
      !belongsToTld(domain.name, UnstoppableDomainTlds.Coin)
    ) {
      const socialPictureValue = resolution.resolution['social.picture.value'];
      const pfpImageFromCDN =
        socialPictureValue &&
        (await getOrCacheNowPfpNFT(
          socialPictureValue,
          domain,
          resolution,
          withOverlay ? ImageType.WithOverlay : ImageType.Simple,
        ));

      return (
        pfpImageFromCDN ||
        (await pathThatSvg(
          await this.generateImageData(name, resolution?.resolution || {}),
        ))
      );
    }

    return await pathThatSvg(
      await this.generateImageData(name, resolution?.resolution || {}),
    );
  }

  private async defaultMetaResponse(
    domainOrToken: string,
  ): Promise<OpenSeaMetadata> {
    const name = domainOrToken.includes('.') ? domainOrToken : null;
    const description = name ? this.getDomainDescription(name, {}) : null;
    const attributes = name ? this.getAttributeType(new Domain({ name })) : [];
    const image = name ? this.generateDomainImageUrl(name) : null;
    const image_data = name
      ? toBase64DataURI(await this.generateImageData(name, {}))
      : null;
    const external_url = name
      ? `https://unstoppabledomains.com/search?searchTerm=${name}`
      : null;
    return {
      name,
      description,
      properties: {
        records: {},
      },
      external_url,
      attributes,
      image,
      image_data,
    };
  }

  private getDomainDescription(
    name: string,
    resolution: Record<string, string>,
  ): string {
    const levels = name.split('.').length;
    const ipfsDescriptionPart = this.getIpfsDescriptionPart(resolution);

    // todo find a better way for this edge case.
    if (name === 'india.crypto') {
      return 'This exclusive art piece by Amrit Pal Singh features hands of different skin tones spelling out the word HOPE in sign language. Hope embodies people coming together and having compassion for others in a way that transcends geographical borders. This art is a reminder that, while one individual can’t uplift humanity on their own, collective and inclusive efforts give rise to meaningful change.'.concat(
        ipfsDescriptionPart,
      );
    }

    if (levels === 1) {
      return "This is the only TLD on the Unstoppable registry. It's not owned by anyone.".concat(
        ipfsDescriptionPart,
      );
    } else if (levels === 2) {
      const description = belongsToTld(name, UnstoppableDomainTlds.Coin)
        ? '.coin domains are no longer supported by Unstoppable Domains. As a result, records of such domains cannot be updated. Learn more at our blog: https://unstoppabledomains.com/blog/coin. '
        : 'A CNS or UNS blockchain domain. Use it to resolve your cryptocurrency addresses and decentralized websites.';
      return description.concat(ipfsDescriptionPart);
    }

    return 'BE CAREFUL! This is a subdomain. Even after purchasing this name, the parent domain has the right to revoke ownership of this domain at anytime. Unless the parent is a smart contract specifically designed otherwise.'.concat(
      ipfsDescriptionPart,
    );
  }

  private getIpfsDescriptionPart(records: Record<string, string>): string {
    const ipfsHash = records['dweb.ipfs.hash'] || records['ipfs.html.value'];
    if (ipfsHash) {
      return `\nhttps://gateway.pinata.cloud/ipfs/${ipfsHash}`;
    }
    return '';
  }

  private getAttributeType(
    domain: Domain,
    meta?: {
      verifiedNftPicture?: boolean;
    },
  ): OpenSeaMetadataAttribute[] {
    const attributes: OpenSeaMetadataAttribute[] = [
      {
        trait_type: DomainAttributeTrait.Ending,
        value: domain.extension,
      },
      {
        trait_type: DomainAttributeTrait.Level,
        value: domain.name.split('.').length,
      },
      {
        trait_type: DomainAttributeTrait.Length,
        value: domain.label.length,
      },
      {
        trait_type: DomainAttributeTrait.Type,
        value: getAttributeType(domain.name),
      },
    ];
    const category = getAttributeCategory(domain);
    if (category) {
      attributes.push({
        trait_type: DomainAttributeTrait.Category,
        value: category,
      });
    }
    const characterSet = getAttributeCharacterSet(domain);
    if (characterSet !== AttributeCharacterSet.None) {
      attributes.push({
        trait_type: DomainAttributeTrait.AttributeCharacterSet,
        value: characterSet,
      });
    }
    if (meta?.verifiedNftPicture) {
      attributes.push({
        trait_type: DomainAttributeTrait.Picture,
        value: AttributePictureType.VerifiedNft,
      });
    }

    return attributes;
  }

  private isDomainWithCustomImage(name: string): boolean {
    return Boolean(CustomImageDomains[name]);
  }

  private async generateImageData(
    name: string,
    resolution: Record<string, string>,
  ): Promise<string> {
    const splittedName = name.replace(/\.svg/g, '').split('.');
    const extension = splittedName.pop() || '';
    const label = splittedName.join('.');

    // .coin TLD is deprecated, UD does not support record updates anymore
    if (extension === UnstoppableDomainTlds.Coin) {
      return this.generateDefaultImageData(label, extension);
    }

    if (this.isDomainWithCustomImage(name)) {
      return '';
    }

    const animalImage = await AnimalHelper.getAnimalImageData(name);
    if (animalImage) {
      return animalImage;
    }

    const imagePathFromDomain = resolution['social.image.value'];
    if (
      imagePathFromDomain &&
      imagePathFromDomain.startsWith(
        'https://cdn.unstoppabledomains.com/bucket/',
      ) &&
      imagePathFromDomain.endsWith('.svg')
    ) {
      try {
        const ret = await fetch(imagePathFromDomain);
        return await ret.text();
      } catch (error) {
        logger.error(
          `Failed to generate image data from the following endpoint: ${imagePathFromDomain}`,
        );
        logger.error(error);
        return this.generateDefaultImageData(label, extension);
      }
    }
    return this.generateDefaultImageData(label, extension);
  }

  private generateDefaultImageData(label: string, tld: string) {
    let fontSize: MetadataImageFontSize = 24;
    if (label.length > 21) {
      fontSize = 20;
    }
    if (label.length > 24) {
      fontSize = 18;
    }
    if (label.length > 27) {
      fontSize = 16;
    }
    if (label.length > 30) {
      label = label.substring(0, 29).concat('...');
    }
    return DefaultImageData({
      label,
      tld: tld as UnstoppableDomainTld,
      fontSize,
    });
  }

  private generateDomainImageUrl(name: string): string {
    if (this.isDomainWithCustomImage(name)) {
      return `${BASE_IMAGE_URL}/${CustomImageDomains[name]}`;
    }

    const animalImageUrl = AnimalHelper.getAnimalImageUrl(name);
    if (animalImageUrl) {
      return animalImageUrl;
    }

    return DEFAULT_IMAGE_URL(name);
  }
}

// maybe move to a helper file
export async function fetchTokenMetadata(
  resolution: DomainsResolution,
): Promise<TokenMetadata> {
  async function fetchOpenSeaMetadata(
    contractAddress: string,
    tokenId: string,
  ) {
    const openSea = initOpenSeaSdk();
    const response = await openSea.api.getAsset({
      tokenAddress: contractAddress,
      tokenId: tokenId,
    });
    return {
      image: response.imageUrl.endsWith('=s250')
        ? response.imageUrl.split('=s250')[0]
        : response.imageUrl,
      background_color: response.backgroundColor,
      owner_of: response.owner.address,
    };
  }

  async function fetchMoralisMetadata(options: {
    chain: SupportedL2Chain | 'eth';
    address: string;
    token_id: string;
  }) {
    const moralis = await initMoralisSdk();
    return await moralis.Web3API.token.getTokenIdMetadata(options);
  }

  let chainId = '';
  let contractAddress = '';
  let tokenId = '';

  if (resolution.resolution['social.picture.value']) {
    try {
      const parsedPicture = parsePictureRecord(
        resolution.resolution['social.picture.value'],
      );

      chainId = parsedPicture.chainId;
      contractAddress = parsedPicture.contractAddress;
      tokenId = parsedPicture.tokenId;
    } catch (error) {
      console.log(error);
    }
  }

  const options = {
    chain: getChainName(chainId),
    address: contractAddress,
    token_id: tokenId,
  };
  let image = '';
  let fetchedMetadata;
  let tokenIdMetadata;
  let validNftPfp = false;

  if (options.address && options.token_id) {
    try {
      if (options.chain === 'eth') {
        fetchedMetadata = await fetchOpenSeaMetadata(contractAddress, tokenId);
        image = fetchedMetadata.image;
      } else {
        tokenIdMetadata = await fetchMoralisMetadata(options);
      }
    } catch (error: any) {
      if (!error.message.includes('No metadata found')) {
        logger.error(error);
      }
    }
  }
  const fetchedOwnerAddress =
    (tokenIdMetadata as any)?.owner_of || fetchedMetadata?.owner_of || '';
  if (
    resolution?.ownerAddress &&
    fetchedOwnerAddress.toLowerCase() === resolution.ownerAddress.toLowerCase()
  ) {
    validNftPfp = true;
  }
  if (validNftPfp && tokenIdMetadata?.metadata) {
    try {
      fetchedMetadata = JSON.parse(tokenIdMetadata.metadata);
      image = fetchedMetadata?.image;
    } catch (error) {
      console.log(error);
    }
  }

  if (validNftPfp && !image && !!tokenIdMetadata?.token_uri) {
    const response = await fetch(tokenIdMetadata.token_uri, {
      timeout: 5000,
    });
    fetchedMetadata = await response.json();
    image = fetchedMetadata?.image;
  }
  return { fetchedMetadata, image }; // TODO: get rid of socialPicture param
}

enum ImageType {
  Simple, // picture only
  WithOverlay, // picture + domain + logo (square)
  MetaImage, // picture + domai + QR code (rectangualar, used for meta tags)
}

async function getOrCacheNowPfpNFT(
  socialPicture: string,
  domain: Domain,
  resolution: DomainsResolution,
  imageType: ImageType,
) {
  const cachedPfpNFT = await getNftPfpImageFromCDN(
    socialPicture,
    imageType === ImageType.WithOverlay || imageType === ImageType.MetaImage
      ? domain.name
      : undefined,
    imageType === ImageType.MetaImage ? true : undefined,
  );
  if (!cachedPfpNFT) {
    await cacheSocialPictureInCDN(socialPicture, domain, resolution);
    // This is not optimal, should return image instead of 2nd call
    // TODO: improve PFP NFT fetching after caching in CDN
    const trulyCachedPFPNFT = await getNftPfpImageFromCDN(
      socialPicture,
      imageType === ImageType.WithOverlay || imageType === ImageType.MetaImage
        ? domain.name
        : undefined,
      imageType === ImageType.MetaImage ? true : undefined,
    );
    return trulyCachedPFPNFT;
  }
  return cachedPfpNFT;
}
