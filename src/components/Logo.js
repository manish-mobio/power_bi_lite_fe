import React from 'react';
import PropTypes from 'prop-types';
import Image from 'next/image';

// Icons import
import LogoIcon from '../icons/logo.png';

// Utils import
import { IMAGE_ALT_TEXT } from '@/utils/constants';

const Logo = ({ imgSrc }) => {
  return <Image alt={IMAGE_ALT_TEXT.logo} src={imgSrc || LogoIcon} />;
};

Logo.propTypes = {
  imgSrc: PropTypes.string,
};

export default Logo;
