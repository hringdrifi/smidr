const VIA_DEFINITION_BASE_URL = 'https://usevia.app/definitions/v3';

export const getViaDefinitionUrl = (vendorProductId: number): string => {
  return `${VIA_DEFINITION_BASE_URL}/${vendorProductId >>> 0}.json`;
};

export const fetchViaDefinition = async (vendorProductId: number): Promise<any | null> => {
  if (typeof fetch === 'undefined') return null;

  const response = await fetch(getViaDefinitionUrl(vendorProductId));
  if (!response.ok) return null;

  return response.json();
};
