import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchViaDefinition, getViaDefinitionUrl } from '../via-definitions';

describe('via-definitions', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('builds official VIA v3 definition URLs from unsigned vendorProductId values', () => {
    expect(getViaDefinitionUrl(0x1234ABCD)).toBe('https://usevia.app/definitions/v3/305441741.json');
    expect(getViaDefinitionUrl(-1)).toBe('https://usevia.app/definitions/v3/4294967295.json');
  });

  it('returns parsed JSON when the definition exists', async () => {
    const definition = { name: 'Fetched VIA' };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(definition),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchViaDefinition(0x1234ABCD)).resolves.toEqual(definition);
    expect(fetchMock).toHaveBeenCalledWith('https://usevia.app/definitions/v3/305441741.json');
  });

  it('returns null when the definition is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));

    await expect(fetchViaDefinition(0x1234ABCD)).resolves.toBeNull();
  });
});
