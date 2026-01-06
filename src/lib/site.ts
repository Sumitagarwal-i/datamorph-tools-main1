export const SITE_ORIGIN = "https://www.datumintapp.com";
export const SITE_NAME = "DatumInt";

export const buildAbsoluteUrl = (path: string) => {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_ORIGIN}${normalized}`;
};
