import { expect } from 'chai';
import {
  AttributeCharacterSet,
  AttributeCategory,
  getAttributeCharacterSet,
  getNumberClub,
} from '.';
import { Domain } from '../../models';

describe('getNumberClub', () => {
  it('should not return anything', () => {
    const domainNames = [
      'testing.nft',
      '000200000002.x',
      '0.x',
      '00.x',
      '1.x',
      '02.x',
      '01.x',
      '10000000.nft',
      '32222222.nft',
      '0000k.x',
      '10000f1.nft',
      '0x12333.nft',
    ];
    for (const domainName of domainNames) {
      expect(getNumberClub(new Domain({ name: domainName }))).to.equal(null);
    }
  });
  it('should return 999 club', () => {
    const domainNames = [
      '000.x',
      '001.x',
      '002.nft',
      '010.blockchain',
      '202.crypto',
      '102.x',
      '999.nft',
      '999.nft',
    ];
    for (const domainName of domainNames) {
      expect(getNumberClub(new Domain({ name: domainName }))).to.equal(
        AttributeCategory['999Club'],
      );
    }
  });
  it('should return 10k club', () => {
    const domainNames = [
      '0992.x',
      '0322.nft',
      '9999.x',
      '0999.x',
      '1000.x',
      '0001.x',
      '0000.x',
      '0101.x',
      '0111.x',
      '0100.x',
      '1000.x',
      '1001.x',
    ];
    for (const domainName of domainNames) {
      expect(getNumberClub(new Domain({ name: domainName }))).to.equal(
        AttributeCategory['10kClub'],
      );
    }
  });
  it('should return 100k club', () => {
    const domainNames = [
      '99990.x',
      '10000.nft',
      '01999.x',
      '10010.x',
      '00000.x',
      '00001.x',
    ];
    for (const domainName of domainNames) {
      expect(getNumberClub(new Domain({ name: domainName }))).to.equal(
        AttributeCategory['100kClub'],
      );
    }
  });
});
describe('getAttributeCharacterSet', () => {
  it('should return digit', () => {
    const domainNames = [
      '002.x',
      '0.nft',
      '1000000.x',
      '0202.x',
      '0000.blockchain',
    ];
    for (const domainName of domainNames) {
      expect(
        getAttributeCharacterSet(new Domain({ name: domainName })),
      ).to.equal(AttributeCharacterSet.Digit);
    }
  });
  it('should return alphanumeric', () => {
    const domainNames = [
      '1awef.crypto',
      'wefwef2.nft',
      'ef1ef.x',
      'wef2024Fs.blockchain',
      '0x199fnfwnef.nft',
    ];
    for (const domainName of domainNames) {
      expect(
        getAttributeCharacterSet(new Domain({ name: domainName })),
      ).to.equal(AttributeCharacterSet.Alphanumeric);
    }
  });
  it('should return letter', () => {
    const domainNames = [
      'edw.nft',
      'WEFff.x',
      'ffvjvnv.crypto',
      'ergeoprgk.blockchain',
      'wef.x',
      'ewkwkw.x',
    ];
    for (const domainName of domainNames) {
      expect(
        getAttributeCharacterSet(new Domain({ name: domainName })),
      ).to.equal(AttributeCharacterSet.Letter);
    }
  });
  it('should return none', () => {
    const domainNames = [
      '9294-2.nft',
      '03080h,22.nft',
      '32*2y2.nft',
      '1-.nft',
      '0202-.nft',
      '-9999.nft',
      '1000-0.nft',
    ];
    for (const domainName of domainNames) {
      expect(
        getAttributeCharacterSet(new Domain({ name: domainName })),
      ).to.equal(AttributeCharacterSet.None);
    }
  });
});
