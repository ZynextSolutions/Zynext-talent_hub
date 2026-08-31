import { XMLParser } from 'fast-xml-parser';
import { AppError } from '../errors/app-error';

type ManifestNode = Record<string, unknown>;

function asArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function readAttr(node: unknown, key: string): string | undefined {
  if (!node || typeof node !== 'object') return undefined;
  const record = node as Record<string, unknown>;
  const direct = record[`@_${key}`] ?? record[key];
  return typeof direct === 'string' ? direct : undefined;
}

function readTitle(node: unknown): string | undefined {
  if (!node || typeof node !== 'object') return undefined;
  const title = (node as ManifestNode).title;
  if (typeof title === 'string') return title.trim();
  if (title && typeof title === 'object' && typeof (title as ManifestNode)['#text'] === 'string') {
    return String((title as ManifestNode)['#text']).trim();
  }
  return undefined;
}

export function parseScormManifest(xml: string): {
  title: string;
  launchHref: string;
  version: '1.2';
} {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    trimValues: true,
  });
  const doc = parser.parse(xml) as ManifestNode;
  const manifest = doc.manifest as ManifestNode | undefined;
  if (!manifest) throw AppError.from('VALIDATION_ERROR', 'Invalid SCORM package: imsmanifest.xml missing.');

  const organizations = manifest.organizations as ManifestNode | undefined;
  const defaultOrgId = readAttr(organizations, 'default');
  const orgNodes = asArray(organizations?.organization);
  const organization =
    orgNodes.find((org) => readAttr(org, 'identifier') === defaultOrgId) ?? orgNodes[0];
  if (!organization) {
    throw AppError.from('VALIDATION_ERROR', 'SCORM manifest has no organizations.');
  }

  const items = asArray((organization as ManifestNode).item);
  const nestedItems = items.flatMap((item) => asArray((item as ManifestNode).item));
  const launchItem =
    items.find((item) => readAttr(item, 'identifierref')) ??
    nestedItems.find((item) => readAttr(item, 'identifierref'));
  const resourceId = launchItem ? readAttr(launchItem, 'identifierref') : undefined;
  if (!resourceId) {
    throw AppError.from('VALIDATION_ERROR', 'SCORM manifest has no launch item.');
  }

  const resources = asArray((manifest.resources as ManifestNode | undefined)?.resource);
  const resource = resources.find((entry) => readAttr(entry, 'identifier') === resourceId);
  const launchHref = resource ? readAttr(resource, 'href') : undefined;
  if (!launchHref) {
    throw AppError.from('VALIDATION_ERROR', 'SCORM manifest launch resource has no href.');
  }

  const title =
    readTitle(launchItem) ??
    readTitle(organization) ??
    readTitle(manifest) ??
    'SCORM package';

  return { title, launchHref, version: '1.2' };
}
