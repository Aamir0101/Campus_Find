import type {
  AuditActionType,
  ClaimStatus,
  ItemCategory,
  ItemStatus,
  MatchClassification,
  ReportType,
} from '../types/domain';

export const ITEM_CATEGORIES: ItemCategory[] = [
  'Electronics',
  'ID Cards',
  'Wallets',
  'Bags',
  'Books',
  'Clothing',
  'Accessories',
  'Keys',
  'Other',
];

export const CAMPUS_BUILDINGS: string[] = [
  'Main University Library',
  'Science & Innovation Center',
  'Student Union Commons',
  'North Quad Lecture Hall',
  'Engineering & Robotics Pavilion',
  'Athletics & Recreation Center',
  'Campus Transit Hub',
];

export function formatShortDate(isoDate: string): string {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) {
    return isoDate;
  }
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(parsed);
}

export function formatDateTime(isoTimestamp: string): string {
  const parsed = new Date(isoTimestamp);
  if (Number.isNaN(parsed.getTime())) {
    return isoTimestamp;
  }
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(parsed);
}

export function formatReportTypeLabel(type: ReportType): string {
  return type === 'LOST' ? 'Lost Report' : 'Found Item';
}

export function formatItemStatusLabel(status: ItemStatus): string {
  switch (status) {
    case 'ACTIVE':
      return 'Active';
    case 'POTENTIAL_MATCH':
      return 'Potential Match';
    case 'CLAIM_PENDING':
      return 'Claim Pending';
    case 'UNDER_VERIFICATION':
      return 'Under Verification';
    case 'RETURNED':
      return 'Returned';
    case 'CLOSED':
      return 'Closed';
  }
}

export function formatClaimStatusLabel(status: ClaimStatus): string {
  switch (status) {
    case 'PENDING':
      return 'Pending Review';
    case 'UNDER_REVIEW':
      return 'Under Review';
    case 'APPROVED':
      return 'Approved for Pickup';
    case 'REJECTED':
      return 'Rejected';
    case 'RETURNED':
      return 'Returned';
  }
}

export function formatConfidenceLabel(classification: MatchClassification): string {
  return classification;
}

export function formatAuditActionLabel(action: AuditActionType): string {
  switch (action) {
    case 'USER_REGISTERED':
      return 'User Registered';
    case 'REPORT_CREATED':
      return 'Report Filed';
    case 'REPORT_UPDATED':
      return 'Report Updated';
    case 'REPORT_STATUS_CHANGED':
      return 'Status Updated';
    case 'MATCH_CREATED':
      return 'Match Flagged';
    case 'MATCH_REVIEWED':
      return 'Match Reviewed';
    case 'CLAIM_SUBMITTED':
      return 'Claim Submitted';
    case 'CLAIM_REVIEWED':
      return 'Claim Under Review';
    case 'CLAIM_APPROVED':
      return 'Claim Approved';
    case 'CLAIM_REJECTED':
      return 'Claim Rejected';
    case 'CUSTODY_RELEASED':
      return 'Custody Returned';
  }
}
