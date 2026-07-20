import { IncidentCategory } from '../../../generated/prisma/client';

const CATEGORY_META: Record<
  IncidentCategory,
  {
    name: string;
    description: string;
    iconName: string;
    requiresImmediateEscalation: boolean;
  }
> = {
  [IncidentCategory.THEFT]: {
    name: 'Theft',
    description: 'Theft or attempted theft of property',
    iconName: 'bag',
    requiresImmediateEscalation: true,
  },
  [IncidentCategory.TRESPASSING]: {
    name: 'Trespassing',
    description: 'Unauthorised presence on site',
    iconName: 'person',
    requiresImmediateEscalation: true,
  },
  [IncidentCategory.VIOLENCE]: {
    name: 'Violence',
    description: 'Assault, threat, or violent behaviour',
    iconName: 'warning',
    requiresImmediateEscalation: true,
  },
  [IncidentCategory.FIRE]: {
    name: 'Fire',
    description: 'Fire, smoke, or related hazard',
    iconName: 'flame',
    requiresImmediateEscalation: true,
  },
  [IncidentCategory.MEDICAL_EMERGENCY]: {
    name: 'Medical emergency',
    description: 'Injury or medical incident on site',
    iconName: 'medkit',
    requiresImmediateEscalation: true,
  },
  [IncidentCategory.PROPERTY_DAMAGE]: {
    name: 'Property damage',
    description: 'Damage to buildings, vehicles, or assets',
    iconName: 'construct',
    requiresImmediateEscalation: false,
  },
  [IncidentCategory.SUSPICIOUS_ACTIVITY]: {
    name: 'Suspicious activity',
    description: 'Unusual or suspicious behaviour',
    iconName: 'eye',
    requiresImmediateEscalation: false,
  },
  [IncidentCategory.MISSING_PROPERTY]: {
    name: 'Missing property',
    description: 'Lost or missing property report',
    iconName: 'help-circle',
    requiresImmediateEscalation: false,
  },
  [IncidentCategory.ACCESS_CONTROL_VIOLATION]: {
    name: 'Access control violation',
    description: 'Unauthorised access or credential misuse',
    iconName: 'key',
    requiresImmediateEscalation: true,
  },
  [IncidentCategory.WORKPLACE_ACCIDENT]: {
    name: 'Workplace accident',
    description: 'Accident or safety incident at work',
    iconName: 'alert-circle',
    requiresImmediateEscalation: true,
  },
  [IncidentCategory.SECURITY_BREACH]: {
    name: 'Security breach',
    description: 'Breach of security controls or perimeter',
    iconName: 'shield',
    requiresImmediateEscalation: true,
  },
  [IncidentCategory.PUBLIC_DISTURBANCE]: {
    name: 'Public disturbance',
    description: 'Disturbance affecting public order on site',
    iconName: 'people',
    requiresImmediateEscalation: false,
  },
  [IncidentCategory.EQUIPMENT_FAILURE]: {
    name: 'Equipment failure',
    description: 'Security or site equipment malfunction',
    iconName: 'hardware-chip',
    requiresImmediateEscalation: false,
  },
  [IncidentCategory.OTHER]: {
    name: 'Other',
    description: 'Other incident type',
    iconName: 'ellipsis-horizontal',
    requiresImmediateEscalation: false,
  },
};

export function listIncidentCategories() {
  return Object.values(IncidentCategory).map((code, index) => {
    const meta = CATEGORY_META[code];
    return {
      id: code,
      code,
      name: meta.name,
      description: meta.description,
      iconName: meta.iconName,
      requiresImmediateEscalation: meta.requiresImmediateEscalation,
      sortOrder: index + 1,
      isActive: true,
    };
  });
}
