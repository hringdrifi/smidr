const VIA_DEFINITION_BASE_URL = 'https://usevia.app/definitions';
const VIA_DEFINITION_VERSION = 'v3';

export const getViaDefinitionUrl = (vendorProductId: number): string => {
  return `${VIA_DEFINITION_BASE_URL}/${VIA_DEFINITION_VERSION}/${vendorProductId >>> 0}.json`;
};

export const getViaSupportedKeyboardsUrl = (): string => {
  return `${VIA_DEFINITION_BASE_URL}/supported_kbs.json`;
};

export const fetchViaDefinition = async (vendorProductId: number): Promise<any | null> => {
  if (typeof fetch === 'undefined') return null;

  const unsignedVendorProductId = vendorProductId >>> 0;
  const indexResponse = await fetch(getViaSupportedKeyboardsUrl());
  if (!indexResponse.ok) return null;

  const index = await indexResponse.json();
  const supportedV3Ids = Array.isArray(index?.vendorProductIds?.v3)
    ? index.vendorProductIds.v3
    : [];

  if (!supportedV3Ids.includes(unsignedVendorProductId)) return null;

  const response = await fetch(getViaDefinitionUrl(vendorProductId));
  if (!response.ok) return null;
  if (!response.headers.get('content-type')?.includes('application/json')) return null;

  return response.json();
};
