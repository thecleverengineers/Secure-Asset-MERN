import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import {
  Accordion, AccordionDetails, AccordionSummary, Alert, Avatar, Box, Button, ButtonBase, Card, CardContent, Chip, CircularProgress, DialogActions, DialogContent, DialogTitle, Divider,
  FormControl, FormControlLabel, IconButton, InputAdornment, InputLabel, Menu, MenuItem, Pagination, Paper, Radio, RadioGroup, Select, Snackbar, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Tooltip, Typography, useMediaQuery, useTheme,
} from '@mui/material';
import ProfessionalDialog from '../../components/shared/ProfessionalDialog';
import AddRounded from '@mui/icons-material/AddRounded';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import ChevronLeftRounded from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRounded from '@mui/icons-material/ChevronRightRounded';
import CloseRounded from '@mui/icons-material/CloseRounded';
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded';
import DescriptionRounded from '@mui/icons-material/DescriptionRounded';
import EditRounded from '@mui/icons-material/EditRounded';
import FileDownloadRounded from '@mui/icons-material/FileDownloadRounded';
import ImageNotSupportedRounded from '@mui/icons-material/ImageNotSupportedRounded';
import MoreVertRounded from '@mui/icons-material/MoreVertRounded';
import RefreshRounded from '@mui/icons-material/RefreshRounded';
import SearchRounded from '@mui/icons-material/SearchRounded';
import ExpandMoreRounded from '@mui/icons-material/ExpandMoreRounded';
import PhotoCameraRounded from '@mui/icons-material/PhotoCameraRounded';
import UploadFileRounded from '@mui/icons-material/UploadFileRounded';
import VisibilityRounded from '@mui/icons-material/VisibilityRounded';
import WorkspacePremiumRounded from '@mui/icons-material/WorkspacePremiumRounded';
import RestartAltRounded from '@mui/icons-material/RestartAltRounded';
import ZoomInRounded from '@mui/icons-material/ZoomInRounded';
import ZoomOutRounded from '@mui/icons-material/ZoomOutRounded';
import ArrowOutwardRounded from '@mui/icons-material/ArrowOutwardRounded';
import { useAuth } from '../../context/AuthContext';
import {
  API_BASE, acceptSurveyQuotation, approveTenantSubscription, rejectTenantSubscription, changeResourceStatus, createResource, deleteResource, downloadReport, downloadSurveyReport, finalizeSurveyReport, fetchPropertyImageBlob, fetchPropertyMediaBlob, getAppConfiguration, getMyListings, getMyTenantApplications, getResource, updateResource, uploadDocument, uploadSiteAsset, paySurveyInvoice, reviewSurveyorVerification, decideRentalApplication,
  acceptRentalPayment, rejectRentalPayment, submitRentalInvoicePayment,
} from '../../services/api';
import type { UserRole } from '../../services/types';
import { moduleLabel } from '../../components/layout/AppShell';
import PageHeader from '../../components/layout/PageHeader';
import CompactPageToolbar from '../../components/layout/CompactPageToolbar';
import { useSite } from '../../context/SiteContext';
import { useRealtime } from '../../context/RealtimeContext';
import { useActionDialog } from '../../components/shared/useActionDialog';
import PropertyFormWizard from '../../components/property/PropertyFormWizard';
import ApplicationAgreementPanel from '../../components/application/ApplicationAgreementPanel';
import LocationFields from '../../components/shared/LocationFields';
import { PropertyContextBanner, PropertyDataBlock, PropertySectionHeader } from '../../components/property/PropertyWorkspacePrimitives';
import PropertyPortfolioCard from '../../components/property/PropertyPortfolioCard';
import PropertyPortfolioMobileCard from '../../components/property/PropertyPortfolioMobileCard';
import '../../../styles/my-listings-premium.css';
import '../../../styles/applications-premium.css';

type Field = { name: string; label: string; type?: 'text' | 'number' | 'date' | 'time' | 'datetime' | 'textarea' | 'select' | 'boolean' | 'radio' | 'array' | 'json' | 'reference' | 'password' | 'image'; options?: string[]; reference?: string; required?: boolean };

function toLocalDateTimeInput(value: unknown) {
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

type Column = { path: string; label: string; type?: 'status' | 'money' | 'date' | 'user' | 'property' | 'boolean' };
type Config = { singular: string; columns: Column[]; fields: Field[]; statuses?: string[]; createRoles: UserRole[]; editRoles: UserRole[]; deleteRoles: UserRole[] };

const COMPACT_RESOURCE_MODULES = new Set([
  'properties', 'applications', 'tenant-interviews', 'property-visits', 'tenancies', 'rental-invoices', 'utility-readings',
  'reminder-rules', 'tenant-profiles', 'occupants', 'leases', 'payments', 'complaints', 'facilities', 'facility-bookings',
  'agreement-templates', 'survey-jobs', 'survey-quotations', 'survey-projects',
]);

const roles: UserRole[] = ['admin', 'manager', 'landlord', 'tenant', 'user', 'surveyor'];
const configs: Record<string, Config> = {
  users: { singular: 'User', createRoles: ['admin'], editRoles: ['admin'], deleteRoles: ['admin'], columns: [{ path: 'name', label: 'Name' }, { path: 'email', label: 'Email' }, { path: 'role', label: 'Role', type: 'status' }, { path: 'kycStatus', label: 'KYC', type: 'status' }, { path: 'status', label: 'Status', type: 'status' }, { path: 'country', label: 'Country' }, { path: 'state', label: 'State' }, { path: 'city', label: 'City' }], fields: [{ name: 'avatar', label: 'Avatar', type: 'image' }, { name: 'name', label: 'Full name', required: true }, { name: 'email', label: 'Email', required: true }, { name: 'phone', label: 'Phone' }, { name: 'password', label: 'Password', type: 'password', required: true }, { name: 'role', label: 'Role', type: 'select', options: roles }, { name: 'status', label: 'Status', type: 'select', options: ['active', 'suspended', 'locked'] }, { name: 'kycStatus', label: 'KYC status', type: 'select', options: ['not_started', 'pending', 'verified', 'rejected'] }, { name: 'country', label: 'Country' }, { name: 'state', label: 'State / Province' }, { name: 'city', label: 'City' }] },
  properties: {
    singular: 'Property', createRoles: ['admin', 'landlord', 'tenant'], editRoles: ['admin', 'manager', 'landlord', 'tenant'], deleteRoles: ['admin', 'landlord', 'tenant'],
    statuses: ['draft','pending_approval','available','partially_occupied','occupied','reserved','rented','sold','leased','maintenance','unavailable','archived'],
    columns: [{ path: 'referenceNumber', label: 'Reference' }, { path: 'title', label: 'Property' }, { path: 'type', label: 'Type' }, { path: 'address.city', label: 'City' }, { path: 'purpose', label: 'Purpose', type: 'status' }, { path: 'visibility', label: 'Visibility', type: 'status' }, { path: 'price', label: 'Price', type: 'money' }, { path: 'status', label: 'Status', type: 'status' }],
    fields: [
      { name: 'title', label: 'Property title', required: true }, { name: 'referenceNumber', label: 'Reference number' },
      { name: 'description', label: 'Description', type: 'textarea' },
      { name: 'type', label: 'Property type', type: 'select', options: [], required: true }, { name: 'customType', label: 'Custom property type' },
      { name: 'purpose', label: 'Purpose', type: 'select', options: ['rent', 'sale', 'lease'], required: true },
      { name: 'visibility', label: 'Listing visibility', type: 'select', options: ['private', 'public'], required: true },
      { name: 'status', label: 'Property status', type: 'select', options: ['draft','pending_approval','available','partially_occupied','occupied','reserved','rented','sold','leased','maintenance','unavailable','archived'] },
      { name: 'pricing.salePrice', label: 'Sale price', type: 'number' }, { name: 'pricing.monthlyRent', label: 'Monthly rent', type: 'number' }, { name: 'pricing.leaseAmount', label: 'Lease amount', type: 'number' },
      { name: 'pricing.securityDeposit', label: 'Security deposit', type: 'number' }, { name: 'pricing.maintenanceCharge', label: 'Maintenance charge', type: 'number' }, { name: 'pricing.negotiable', label: 'Price negotiable', type: 'boolean' },
      { name: 'areas.unit', label: 'Area unit', type: 'select', options: [] }, { name: 'areas.total', label: 'Total area', type: 'number' }, { name: 'areas.carpet', label: 'Carpet area (sq. ft.)', type: 'number' }, { name: 'specifications.carpetAreaSqm', label: 'Carpet area (sq. meter)', type: 'number' }, { name: 'areas.builtUp', label: 'Built-up area (sq. ft.)', type: 'number' }, { name: 'specifications.builtUpAreaSqm', label: 'Built-up area (sq. meter)', type: 'number' }, { name: 'areas.superBuiltUp', label: 'Super built-up area', type: 'number' }, { name: 'areas.plot', label: 'Plot area', type: 'number' },
      { name: 'roomDetails.totalApartments', label: 'Total apartments', type: 'number' }, { name: 'roomDetails.totalRooms', label: 'Total rooms', type: 'number' }, { name: 'roomDetails.bedrooms', label: 'Bedrooms', type: 'number' }, { name: 'roomDetails.masterBedrooms', label: 'Master bedrooms', type: 'number' }, { name: 'roomDetails.bathrooms', label: 'Bathrooms', type: 'number' }, { name: 'roomDetails.toilets', label: 'Toilets', type: 'number' }, { name: 'roomDetails.kitchens', label: 'Kitchens', type: 'number' }, { name: 'roomDetails.livingRooms', label: 'Living rooms', type: 'number' }, { name: 'roomDetails.diningRooms', label: 'Dining rooms', type: 'number' }, { name: 'roomDetails.balconies', label: 'Balconies', type: 'number' }, { name: 'roomDetails.parkingSpaces', label: 'Parking spaces', type: 'number' },
      { name: 'furnishing.status', label: 'Furnishing', type: 'select', options: ['unfurnished', 'semi_furnished', 'fully_furnished'] }, { name: 'furnishing.items', label: 'Furniture and appliances', type: 'array' },
      { name: 'ageDetails.band', label: 'Property age', type: 'select', options: ['new_construction', 'under_construction', 'less_than_1_year', '1_5_years', '5_10_years', '10_20_years', 'more_than_20_years'] }, { name: 'ageDetails.constructionYear', label: 'Construction year', type: 'number' }, { name: 'ageDetails.renovationYear', label: 'Renovation year', type: 'number' }, { name: 'ageDetails.possessionDate', label: 'Possession date', type: 'date' }, { name: 'ageDetails.availableFrom', label: 'Available from', type: 'date' },
      { name: 'address.line1', label: 'Address' }, { name: 'map.locality', label: 'Locality' }, { name: 'address.city', label: 'City', required: true }, { name: 'map.district', label: 'District' }, { name: 'address.state', label: 'State' }, { name: 'address.postalCode', label: 'Postal code' }, { name: 'map.landmark', label: 'Landmark' },
      { name: 'map.latitude', label: 'Latitude', type: 'number' }, { name: 'map.longitude', label: 'Longitude', type: 'number' }, { name: 'locationPrivacy', label: 'Location privacy', type: 'select', options: ['exact_public', 'approximate_public', 'after_application', 'after_visit_approval', 'selected_users'] },
      { name: 'occupancyRules.maxTotal', label: 'Maximum occupants', type: 'number' }, { name: 'occupancyRules.maxAdults', label: 'Maximum adults', type: 'number' }, { name: 'occupancyRules.maxChildren', label: 'Maximum children', type: 'number' }, { name: 'occupancyRules.maxPerRoom', label: 'Maximum occupants per room', type: 'number' },
      { name: 'occupancyRules.familyAllowed', label: 'Families allowed', type: 'boolean' }, { name: 'occupancyRules.bachelorsAllowed', label: 'Bachelors allowed', type: 'boolean' }, { name: 'occupancyRules.studentsAllowed', label: 'Students allowed', type: 'boolean' }, { name: 'occupancyRules.professionalsAllowed', label: 'Working professionals allowed', type: 'boolean' }, { name: 'occupancyRules.sharedOccupancyAllowed', label: 'Shared occupancy allowed', type: 'boolean' }, { name: 'occupancyRules.petsAllowed', label: 'Pets allowed', type: 'boolean' }, { name: 'occupancyRules.additionalOccupantsRequireApproval', label: 'Additional occupants require approval', type: 'boolean' },
      { name: 'amenities', label: 'Amenities', type: 'array' }, { name: 'images', label: 'Property image URLs', type: 'array' }, { name: 'galleryCover', label: 'Cover image URL' },
    ],
  },
  units: { singular: 'Unit', createRoles: ['admin', 'manager'], editRoles: ['admin', 'manager'], deleteRoles: ['admin', 'manager'], statuses: ['vacant', 'occupied', 'reserved', 'maintenance', 'inactive'], columns: [{ path: 'unitNumber', label: 'Unit' }, { path: 'property', label: 'Property', type: 'property' }, { path: 'buildingName', label: 'Building' }, { path: 'floor', label: 'Floor' }, { path: 'monthlyRent', label: 'Rent', type: 'money' }, { path: 'status', label: 'Status', type: 'status' }], fields: [{ name: 'property', label: 'Property', type: 'reference', reference: 'properties', required: true }, { name: 'buildingName', label: 'Building' }, { name: 'floor', label: 'Floor' }, { name: 'unitNumber', label: 'Unit number', required: true }, { name: 'type', label: 'Unit type' }, { name: 'bedrooms', label: 'Bedrooms', type: 'number' }, { name: 'bathrooms', label: 'Bathrooms', type: 'number' }, { name: 'area', label: 'Area', type: 'number' }, { name: 'monthlyRent', label: 'Monthly rent', type: 'number' }, { name: 'securityDeposit', label: 'Security deposit', type: 'number' }, { name: 'status', label: 'Status', type: 'select', options: ['vacant', 'occupied', 'reserved', 'maintenance', 'inactive'] }, { name: 'amenities', label: 'Amenities', type: 'array' }] },
  tenants: { singular: 'Tenant', createRoles: ['admin', 'manager', 'landlord'], editRoles: ['admin', 'manager', 'landlord', 'tenant'], deleteRoles: ['admin', 'landlord'], statuses: ['applicant', 'active', 'notice', 'moved_out', 'rejected'], columns: [{ path: 'user', label: 'Tenant', type: 'user' }, { path: 'property', label: 'Property', type: 'property' }, { path: 'unit.unitNumber', label: 'Unit' }, { path: 'status', label: 'Status', type: 'status' }, { path: 'moveInDate', label: 'Move in', type: 'date' }], fields: [{ name: 'user', label: 'User', type: 'reference', reference: 'users', required: true }, { name: 'property', label: 'Property', type: 'reference', reference: 'properties', required: true }, { name: 'unit', label: 'Unit', type: 'reference', reference: 'units' }, { name: 'status', label: 'Status', type: 'select', options: ['applicant', 'active', 'notice', 'moved_out', 'rejected'] }, { name: 'moveInDate', label: 'Move-in date', type: 'date' }, { name: 'moveOutDate', label: 'Move-out date', type: 'date' }] },
  leases: { singular: 'Lease', createRoles: ['admin', 'manager', 'landlord'], editRoles: ['admin', 'manager', 'landlord'], deleteRoles: ['admin', 'landlord'], statuses: ['draft', 'pending_approval', 'active', 'expiring', 'expired', 'terminated', 'renewed'], columns: [{ path: 'leaseNumber', label: 'Lease no.' }, { path: 'tenant', label: 'Tenant', type: 'user' }, { path: 'property', label: 'Property', type: 'property' }, { path: 'monthlyRent', label: 'Rent', type: 'money' }, { path: 'endDate', label: 'Ends', type: 'date' }, { path: 'status', label: 'Status', type: 'status' }], fields: [{ name: 'property', label: 'Property', type: 'reference', reference: 'properties', required: true }, { name: 'unit', label: 'Unit', type: 'reference', reference: 'units' }, { name: 'tenant', label: 'Tenant user', type: 'reference', reference: 'users', required: true }, { name: 'startDate', label: 'Start date', type: 'date', required: true }, { name: 'endDate', label: 'End date', type: 'date', required: true }, { name: 'monthlyRent', label: 'Monthly rent / lease cycle amount', type: 'number', required: true }, { name: 'securityDeposit', label: 'Security deposit', type: 'number' }, { name: 'paymentCycle', label: 'Payment cycle', type: 'select', options: ['monthly','quarterly','half_yearly','yearly','custom'] }, { name: 'whatsappReminderEnabled', label: 'Auto WhatsApp reminder on due', type: 'boolean' }, { name: 'legalAgreement', label: 'Legal agreement file ID' }, { name: 'escalationPercent', label: 'Escalation %', type: 'number' }, { name: 'status', label: 'Status', type: 'select', options: ['draft', 'pending_approval', 'active', 'expiring', 'expired', 'terminated', 'renewed'] }] },
  surveys: { singular: 'Survey', createRoles: ['admin', 'manager'], editRoles: ['admin', 'manager', 'surveyor'], deleteRoles: ['admin'], statuses: ['assigned', 'in_progress', 'submitted', 'returned', 'approved', 'rejected'], columns: [{ path: 'surveyNumber', label: 'Survey no.' }, { path: 'title', label: 'Survey' }, { path: 'property', label: 'Property', type: 'property' }, { path: 'surveyor', label: 'Surveyor', type: 'user' }, { path: 'priority', label: 'Priority', type: 'status' }, { path: 'deadline', label: 'Deadline', type: 'date' }, { path: 'status', label: 'Status', type: 'status' }], fields: [{ name: 'title', label: 'Survey title', required: true }, { name: 'property', label: 'Property', type: 'reference', reference: 'properties', required: true }, { name: 'unit', label: 'Unit', type: 'reference', reference: 'units' }, { name: 'surveyor', label: 'Surveyor', type: 'reference', reference: 'users' }, { name: 'priority', label: 'Priority', type: 'select', options: ['low', 'medium', 'high', 'urgent'] }, { name: 'deadline', label: 'Deadline', type: 'date' }, { name: 'status', label: 'Status', type: 'select', options: ['assigned', 'in_progress', 'submitted', 'returned', 'approved', 'rejected'] }, { name: 'notes', label: 'Notes', type: 'textarea' }] },
  applications: { singular: 'Application', createRoles: ['admin', 'manager', 'tenant'], editRoles: ['admin', 'manager', 'landlord', 'tenant'], deleteRoles: ['admin', 'tenant'], statuses: ['draft', 'submitted', 'under_review', 'documents_pending', 'approved', 'rejected', 'withdrawn'], columns: [{ path: 'applicationNumber', label: 'Application no.' }, { path: 'applicant', label: 'Applicant', type: 'user' }, { path: 'property', label: 'Property', type: 'property' }, { path: 'step', label: 'Step' }, { path: 'paymentStatus', label: 'Payment', type: 'status' }, { path: 'status', label: 'Status', type: 'status' }, { path: 'createdAt', label: 'Created', type: 'date' }], fields: [{ name: 'property', label: 'Property ID', required: true }, { name: 'unit', label: 'Unit ID' }, { name: 'step', label: 'Application step', type: 'number' }, { name: 'status', label: 'Status', type: 'select', options: ['draft', 'submitted', 'under_review', 'documents_pending', 'approved', 'rejected', 'withdrawn'] }, { name: 'feeAmount', label: 'Application fee', type: 'number' }, { name: 'paymentStatus', label: 'Payment status', type: 'select', options: ['pending', 'paid', 'waived'] }, { name: 'remarks', label: 'Remarks', type: 'textarea' }] },
  payments: { singular: 'Payment', createRoles: ['admin', 'manager', 'landlord', 'tenant', 'user'], editRoles: ['admin', 'manager', 'landlord'], deleteRoles: ['admin'], statuses: ['pending', 'paid', 'partial', 'overdue', 'failed', 'cancelled', 'refunded', 'waived'], columns: [{ path: 'invoiceNumber', label: 'Invoice' }, { path: 'payer', label: 'Payer', type: 'user' }, { path: 'property', label: 'Property', type: 'property' }, { path: 'type', label: 'Type' }, { path: 'amount', label: 'Amount', type: 'money' }, { path: 'dueDate', label: 'Due', type: 'date' }, { path: 'paymentVerification.status', label: 'Review', type: 'status' }, { path: 'status', label: 'Status', type: 'status' }], fields: [{ name: 'property', label: 'Property', type: 'reference', reference: 'properties' }, { name: 'lease', label: 'Lease', type: 'reference', reference: 'leases' }, { name: 'type', label: 'Payment type', type: 'select', options: ['rent', 'lease', 'sale', 'deposit', 'application_fee', 'maintenance', 'penalty', 'refund', 'landlord_subscription', 'surveyor_subscription', 'other'] }, { name: 'amount', label: 'Amount', type: 'number', required: true }, { name: 'paidAmount', label: 'Paid amount', type: 'number' }, { name: 'dueDate', label: 'Due date', type: 'date' }, { name: 'status', label: 'Status', type: 'select', options: ['pending', 'paid', 'partial', 'overdue', 'failed', 'cancelled', 'refunded', 'waived'] }, { name: 'method', label: 'Method', type: 'select', options: ['upi', 'card', 'bank_transfer', 'cash', 'cheque', 'gateway', 'offline'] }, { name: 'transactionId', label: 'Transaction ID' }, { name: 'notes', label: 'Notes', type: 'textarea' }] },
  complaints: { singular: 'Complaint', createRoles: ['admin', 'manager', 'landlord', 'tenant', 'user'], editRoles: ['admin', 'manager', 'landlord', 'tenant', 'user'], deleteRoles: ['admin'], statuses: ['open', 'assigned', 'in_progress', 'awaiting_approval', 'resolved', 'closed', 'reopened'], columns: [{ path: 'complaintNumber', label: 'Complaint no.' }, { path: 'title', label: 'Complaint' }, { path: 'raisedBy', label: 'Raised by', type: 'user' }, { path: 'property', label: 'Property', type: 'property' }, { path: 'priority', label: 'Priority', type: 'status' }, { path: 'slaDueAt', label: 'SLA due', type: 'date' }, { path: 'status', label: 'Status', type: 'status' }], fields: [{ name: 'title', label: 'Title', required: true }, { name: 'description', label: 'Description', type: 'textarea', required: true }, { name: 'property', label: 'Property', type: 'reference', reference: 'properties' }, { name: 'unit', label: 'Unit ID' }, { name: 'category', label: 'Category' }, { name: 'priority', label: 'Priority', type: 'select', options: ['low', 'medium', 'high', 'urgent'] }, { name: 'status', label: 'Status', type: 'select', options: ['open', 'assigned', 'in_progress', 'awaiting_approval', 'resolved', 'closed', 'reopened'] }, { name: 'assignedTo', label: 'Assigned user ID' }, { name: 'estimatedCost', label: 'Estimated cost', type: 'number' }, { name: 'slaDueAt', label: 'SLA due date', type: 'date' }] },
  approvals: { singular: 'Approval', createRoles: roles, editRoles: ['admin', 'manager'], deleteRoles: ['admin'], statuses: ['pending', 'approved', 'rejected', 'returned', 'escalated', 'cancelled'], columns: [{ path: 'title', label: 'Approval' }, { path: 'type', label: 'Type' }, { path: 'requester', label: 'Requester', type: 'user' }, { path: 'property', label: 'Property', type: 'property' }, { path: 'amount', label: 'Amount', type: 'money' }, { path: 'priority', label: 'Priority', type: 'status' }, { path: 'status', label: 'Status', type: 'status' }], fields: [{ name: 'title', label: 'Title', required: true }, { name: 'type', label: 'Request type', required: true }, { name: 'property', label: 'Property', type: 'reference', reference: 'properties', required: true }, { name: 'amount', label: 'Amount', type: 'number' }, { name: 'priority', label: 'Priority', type: 'select', options: ['low', 'medium', 'high', 'urgent'] }, { name: 'status', label: 'Status', type: 'select', options: ['pending', 'approved', 'rejected', 'returned', 'escalated', 'cancelled'] }] },
  notifications: { singular: 'Notification', createRoles: ['admin', 'manager'], editRoles: roles, deleteRoles: roles, columns: [{ path: 'title', label: 'Notification' }, { path: 'category', label: 'Category', type: 'status' }, { path: 'message', label: 'Message' }, { path: 'readAt', label: 'Read', type: 'date' }, { path: 'createdAt', label: 'Sent', type: 'date' }], fields: [{ name: 'user', label: 'Recipient user ID', required: true }, { name: 'title', label: 'Title', required: true }, { name: 'message', label: 'Message', type: 'textarea', required: true }, { name: 'category', label: 'Category', type: 'select', options: ['payment', 'survey', 'complaint', 'lease', 'maintenance', 'system', 'message'] }, { name: 'actionUrl', label: 'Action URL' }] },
  messages: { singular: 'Message', createRoles: roles, editRoles: roles, deleteRoles: roles, columns: [{ path: 'conversationId', label: 'Conversation' }, { path: 'sender', label: 'Sender', type: 'user' }, { path: 'body', label: 'Message' }, { path: 'createdAt', label: 'Sent', type: 'date' }], fields: [{ name: 'conversationId', label: 'Conversation ID', required: true }, { name: 'recipients', label: 'Recipient user IDs', type: 'array', required: true }, { name: 'body', label: 'Message', type: 'textarea', required: true }] },
  documents: { singular: 'Document', createRoles: roles, editRoles: ['admin', 'manager'], deleteRoles: roles, columns: [{ path: 'name', label: 'Document' }, { path: 'type', label: 'Type', type: 'status' }, { path: 'owner', label: 'Owner', type: 'user' }, { path: 'property', label: 'Property', type: 'property' }, { path: 'sizeBytes', label: 'Size' }, { path: 'createdAt', label: 'Uploaded', type: 'date' }], fields: [{ name: 'name', label: 'Document name' }, { name: 'type', label: 'Type', type: 'select', options: ['lease_agreement', 'id_proof', 'noc', 'survey_report', 'utility_bill', 'photo', 'other'] }, { name: 'property', label: 'Property', type: 'reference', reference: 'properties', required: true }, { name: 'visibility', label: 'Visibility', type: 'select', options: ['private', 'property', 'public'] }] },
  attendance: { singular: 'Attendance record', createRoles: [], editRoles: ['admin', 'manager', 'surveyor'], deleteRoles: ['admin'], columns: [{ path: 'user', label: 'Surveyor', type: 'user' }, { path: 'date', label: 'Date' }, { path: 'checkInAt', label: 'Check in', type: 'date' }, { path: 'checkOutAt', label: 'Check out', type: 'date' }, { path: 'status', label: 'Status', type: 'status' }], fields: [] },
  'audit-logs': { singular: 'Audit log', createRoles: [], editRoles: [], deleteRoles: [], columns: [{ path: 'user', label: 'User', type: 'user' }, { path: 'role', label: 'Role', type: 'status' }, { path: 'action', label: 'Action' }, { path: 'module', label: 'Module' }, { path: 'ip', label: 'IP address' }, { path: 'device', label: 'Device' }, { path: 'createdAt', label: 'Date & time', type: 'date' }], fields: [] },
  'surveyor-plans': { singular: 'Surveyor plan', createRoles: ['admin'], editRoles: ['admin'], deleteRoles: ['admin'], columns: [{ path: 'name', label: 'Plan' }, { path: 'key', label: 'Key' }, { path: 'prices.monthly', label: 'Monthly', type: 'money' }, { path: 'prices.yearly', label: 'Yearly', type: 'money' }, { path: 'limits.publicServices', label: 'Public services' }, { path: 'limits.quotationsPerMonth', label: 'Quotes/month' }, { path: 'active', label: 'Active', type: 'boolean' }], fields: [{ name: 'name', label: 'Plan name', required: true }, { name: 'key', label: 'Plan key', required: true }, { name: 'description', label: 'Description', type: 'textarea' }, { name: 'prices.monthly', label: 'Monthly price', type: 'number' }, { name: 'prices.yearly', label: 'Yearly price', type: 'number' }, { name: 'limits.publicServices', label: 'Public services', type: 'number' }, { name: 'limits.jobsPerMonth', label: 'Jobs/month', type: 'number' }, { name: 'limits.quotationsPerMonth', label: 'Quotations/month', type: 'number' }, { name: 'limits.teamMembers', label: 'Team members', type: 'number' }, { name: 'limits.serviceLocations', label: 'Service locations', type: 'number' }, { name: 'limits.storageMb', label: 'Document Vault storage (MB)', type: 'number' }, { name: 'limits.reportsPerMonth', label: 'Reports/month', type: 'number' }, { name: 'limits.clients', label: 'Clients', type: 'number' }, { name: 'graceDays', label: 'Grace days', type: 'number' }, { name: 'supportLevel', label: 'Support', type: 'select', options: ['standard', 'priority', 'dedicated'] }, { name: 'active', label: 'Active', type: 'boolean' }] },
  'surveyor-verifications': { singular: 'Surveyor verification', createRoles: [], editRoles: ['admin'], deleteRoles: [], statuses: ['not_submitted','draft','submitted','under_review','changes_required','verified','rejected','suspended','expired'], columns: [{ path: 'legalName', label: 'Legal name' }, { path: 'user', label: 'Account', type: 'user' }, { path: 'licenceNumber', label: 'Licence' }, { path: 'licenceExpiryDate', label: 'Licence expiry', type: 'date' }, { path: 'status', label: 'Status', type: 'status' }, { path: 'submittedAt', label: 'Submitted', type: 'date' }], fields: [{ name: 'status', label: 'Status', type: 'select', options: ['under_review','changes_required','verified','rejected','suspended','expired'] }, { name: 'reviewerNotes', label: 'Reviewer notes', type: 'textarea' }, { name: 'rejectionReason', label: 'Rejection reason', type: 'textarea' }, { name: 'suspensionReason', label: 'Suspension reason', type: 'textarea' }] },
  'surveyor-profiles': { singular: 'Surveyor profile', createRoles: ['admin','tenant'], editRoles: ['admin','tenant'], deleteRoles: ['admin','tenant'], statuses: ['draft','pending_moderation','published','paused','archived'], columns: [{ path: 'name', label: 'Profile' }, { path: 'profileType', label: 'Type', type: 'status' }, { path: 'verificationStatus', label: 'Verification', type: 'status' }, { path: 'visibility', label: 'Visibility', type: 'status' }, { path: 'publicationStatus', label: 'Publication', type: 'status' }, { path: 'rating.average', label: 'Rating' }], fields: [{ name: 'name', label: 'Name', required: true }, { name: 'professionalTitle', label: 'Professional title' }, { name: 'profileType', label: 'Profile type', type: 'select', options: ['individual','agency'] }, { name: 'description', label: 'Description', type: 'textarea' }, { name: 'yearsExperience', label: 'Years experience', type: 'number' }, { name: 'startingPrice', label: 'Starting price', type: 'number' }, { name: 'availability', label: 'Availability', type: 'select', options: ['available','busy','limited','unavailable'] }, { name: 'visibility', label: 'Visibility', type: 'select', options: ['private','public'] }] },
  'survey-services': { singular: 'Survey service', createRoles: ['admin','tenant'], editRoles: ['admin','tenant'], deleteRoles: ['admin','tenant'], statuses: ['draft','pending_moderation','published','paused','unpublished','archived'], columns: [{ path: 'title', label: 'Service' }, { path: 'category', label: 'Category' }, { path: 'startingPrice', label: 'Starting price', type: 'money' }, { path: 'pricingMethod', label: 'Pricing', type: 'status' }, { path: 'visibility', label: 'Visibility', type: 'status' }, { path: 'status', label: 'Status', type: 'status' }], fields: [{ name: 'title', label: 'Service title', required: true }, { name: 'category', label: 'Category', required: true }, { name: 'subtype', label: 'Subtype' }, { name: 'shortDescription', label: 'Short description' }, { name: 'description', label: 'Detailed description', type: 'textarea' }, { name: 'startingPrice', label: 'Starting price', type: 'number' }, { name: 'pricingMethod', label: 'Pricing method', type: 'select', options: ['fixed','per_acre','per_sq_ft','per_sq_metre','per_kilometre','per_building','per_plot','per_room','hourly','daily','custom_quotation'] }, { name: 'estimatedDuration', label: 'Estimated duration' }, { name: 'availableDays', label: 'Available days', type: 'array' }, { name: 'requiredDocuments', label: 'Required documents', type: 'array' }, { name: 'deliverables', label: 'Deliverables', type: 'array' }, { name: 'equipment', label: 'Equipment used', type: 'array' }, { name: 'teamSizeRequired', label: 'Team size', type: 'number' }, { name: 'travelCharges', label: 'Travel charges' }, { name: 'emergencyAvailable', label: 'Emergency service', type: 'boolean' }, { name: 'onlineConsultation', label: 'Online consultation', type: 'boolean' }, { name: 'revisionPolicy', label: 'Revision policy', type: 'textarea' }, { name: 'cancellationPolicy', label: 'Cancellation policy', type: 'textarea' }, { name: 'terms', label: 'Terms', type: 'textarea' }, { name: 'visibility', label: 'Visibility', type: 'select', options: ['private','public'] }] },
  'survey-jobs': { singular: 'Survey job', createRoles: ['admin','tenant'], editRoles: ['admin','tenant'], deleteRoles: ['admin','tenant'], statuses: ['draft','open','quotation_review','awarded','in_progress','completed','cancelled','expired'], columns: [{ path: 'jobNumber', label: 'Job no.' }, { path: 'title', label: 'Job' }, { path: 'surveyType', label: 'Survey type' }, { path: 'addressApproximate', label: 'Location' }, { path: 'budget.max', label: 'Budget', type: 'money' }, { path: 'visibility', label: 'Visibility', type: 'status' }, { path: 'status', label: 'Status', type: 'status' }], fields: [{ name: 'title', label: 'Job title', required: true }, { name: 'surveyType', label: 'Survey type', required: true }, { name: 'propertyType', label: 'Property or land type' }, { name: 'addressApproximate', label: 'Approximate location' }, { name: 'exactLocation.country', label: 'Country' }, { name: 'exactLocation.state', label: 'State / Province' }, { name: 'exactLocation.city', label: 'City' }, { name: 'exactLocation.address', label: 'Exact address' }, { name: 'plotNumber', label: 'Plot number' }, { name: 'landArea', label: 'Land area', type: 'number' }, { name: 'measurementUnit', label: 'Measurement unit' }, { name: 'purpose', label: 'Purpose' }, { name: 'preferredVisitDate', label: 'Preferred visit', type: 'date' }, { name: 'preferredCompletionDate', label: 'Completion date', type: 'date' }, { name: 'budget.min', label: 'Minimum budget', type: 'number' }, { name: 'budget.max', label: 'Maximum budget', type: 'number' }, { name: 'description', label: 'Description', type: 'textarea' }, { name: 'deliverables', label: 'Deliverables', type: 'array' }, { name: 'siteAccess', label: 'Site access details', type: 'textarea' }, { name: 'urgency', label: 'Urgency', type: 'select', options: ['normal','priority','urgent','emergency'] }, { name: 'visibility', label: 'Visibility', type: 'select', options: ['private','invited','public'] }, { name: 'bookingType', label: 'Booking type', type: 'select', options: ['quotation','instant'] }, { name: 'requiredQualification', label: 'Required qualification' }, { name: 'requiredEquipment', label: 'Required equipment', type: 'array' }, { name: 'status', label: 'Status', type: 'select', options: ['draft','open'] }, { name: 'closesAt', label: 'Applications close', type: 'date' }] },
  'survey-quotations': { singular: 'Quotation', createRoles: ['admin','tenant'], editRoles: ['admin','tenant'], deleteRoles: ['admin','tenant'], statuses: ['draft','submitted','viewed','under_negotiation','revised','accepted','rejected','expired','withdrawn'], columns: [{ path: 'quotationNumber', label: 'Quotation no.' }, { path: 'job.title', label: 'Job' }, { path: 'surveyor', label: 'Surveyor', type: 'user' }, { path: 'client', label: 'Client', type: 'user' }, { path: 'totalAmount', label: 'Total', type: 'money' }, { path: 'validUntil', label: 'Valid until', type: 'date' }, { path: 'status', label: 'Status', type: 'status' }], fields: [{ name: 'job', label: 'Survey job', type: 'reference', reference: 'survey-jobs', required: true }, { name: 'scope', label: 'Scope of work', type: 'textarea' }, { name: 'methodology', label: 'Methodology', type: 'textarea' }, { name: 'deliverables', label: 'Deliverables', type: 'array' }, { name: 'charges.siteVisit', label: 'Site visit charge', type: 'number' }, { name: 'charges.survey', label: 'Survey charge', type: 'number' }, { name: 'charges.travel', label: 'Travel charge', type: 'number' }, { name: 'charges.equipment', label: 'Equipment charge', type: 'number' }, { name: 'charges.tax', label: 'Tax', type: 'number' }, { name: 'charges.discount', label: 'Discount', type: 'number' }, { name: 'totalAmount', label: 'Total amount', type: 'number', required: true }, { name: 'advanceAmount', label: 'Advance amount', type: 'number' }, { name: 'estimatedStartDate', label: 'Estimated start', type: 'date' }, { name: 'estimatedCompletionDate', label: 'Estimated completion', type: 'date' }, { name: 'validUntil', label: 'Valid until', type: 'date' }, { name: 'exclusions', label: 'Exclusions', type: 'array' }, { name: 'terms', label: 'Terms', type: 'textarea' }, { name: 'digitalSignature', label: 'Digital signature' }, { name: 'status', label: 'Status', type: 'select', options: ['draft','submitted'] }] },
  'survey-projects': { singular: 'Survey project', createRoles: ['admin'], editRoles: ['admin','tenant'], deleteRoles: ['admin'], statuses: ['new','awaiting_documents','awaiting_advance_payment','scheduled','site_visit_pending','site_visit_completed','fieldwork_in_progress','data_processing','draft_report_ready','client_review','revision_requested','final_report_ready','completed','on_hold','cancelled','disputed'], columns: [{ path: 'projectNumber', label: 'Project no.' }, { path: 'surveyCategory', label: 'Category' }, { path: 'client', label: 'Client', type: 'user' }, { path: 'surveyor', label: 'Surveyor', type: 'user' }, { path: 'dueDate', label: 'Due date', type: 'date' }, { path: 'paymentSummary.outstanding', label: 'Outstanding', type: 'money' }, { path: 'status', label: 'Status', type: 'status' }], fields: [{ name: 'surveyCategory', label: 'Survey category' }, { name: 'propertySite.ownerName', label: 'Property owner name' }, { name: 'propertySite.propertyType', label: 'Property type' }, { name: 'propertySite.plotNumber', label: 'Plot number' }, { name: 'propertySite.surveyNumber', label: 'Survey number' }, { name: 'propertySite.khataPattaNumber', label: 'Khata/Patta number' }, { name: 'propertySite.country', label: 'Country' }, { name: 'propertySite.state', label: 'State / Province' }, { name: 'propertySite.city', label: 'City' }, { name: 'propertySite.district', label: 'District' }, { name: 'propertySite.fullAddress', label: 'Full private address', type: 'textarea' }, { name: 'propertySite.landArea', label: 'Land area', type: 'number' }, { name: 'startDate', label: 'Start date', type: 'date' }, { name: 'dueDate', label: 'Due date', type: 'date' }, { name: 'priority', label: 'Priority', type: 'select', options: ['low','normal','high','urgent'] }, { name: 'status', label: 'Status', type: 'select', options: ['new','awaiting_documents','awaiting_advance_payment','scheduled','site_visit_pending','site_visit_completed','fieldwork_in_progress','data_processing','draft_report_ready','client_review','revision_requested','final_report_ready','completed','on_hold','cancelled','disputed'] }] },
  'site-visits': { singular: 'Site visit', createRoles: ['admin','tenant'], editRoles: ['admin','tenant'], deleteRoles: ['admin','tenant'], statuses: ['requested','confirmed','rescheduled','surveyor_travelling','surveyor_arrived','in_progress','completed','client_absent','cancelled'], columns: [{ path: 'project.projectNumber', label: 'Project' }, { path: 'requestedStart', label: 'Requested', type: 'date' }, { path: 'confirmedStart', label: 'Confirmed', type: 'date' }, { path: 'route.distanceKm', label: 'Distance km' }, { path: 'status', label: 'Status', type: 'status' }], fields: [{ name: 'project', label: 'Project', type: 'reference', reference: 'survey-projects', required: true }, { name: 'requestedStart', label: 'Requested date', type: 'date' }, { name: 'confirmedStart', label: 'Confirmed date', type: 'date' }, { name: 'estimatedEnd', label: 'Estimated end', type: 'date' }, { name: 'route.origin', label: 'Route origin' }, { name: 'route.destination', label: 'Route destination' }, { name: 'route.distanceKm', label: 'Distance km', type: 'number' }, { name: 'route.travelMinutes', label: 'Travel time minutes', type: 'number' }, { name: 'instructions', label: 'Visit instructions', type: 'textarea' }, { name: 'accessContact.name', label: 'Access contact' }, { name: 'accessContact.phone', label: 'Access phone' }, { name: 'status', label: 'Status', type: 'select', options: ['requested','confirmed','rescheduled','surveyor_travelling','surveyor_arrived','in_progress','completed','client_absent','cancelled'] }] },
  'survey-equipment': { singular: 'Equipment', createRoles: ['admin','tenant'], editRoles: ['admin','tenant'], deleteRoles: ['admin','tenant'], statuses: ['available','assigned','maintenance','calibration_due','retired'], columns: [{ path: 'name', label: 'Equipment' }, { path: 'type', label: 'Type' }, { path: 'brand', label: 'Brand' }, { path: 'model', label: 'Model' }, { path: 'serialNumber', label: 'Serial no.' }, { path: 'nextCalibrationDate', label: 'Calibration due', type: 'date' }, { path: 'availability', label: 'Availability', type: 'status' }], fields: [{ name: 'name', label: 'Equipment name', required: true }, { name: 'type', label: 'Equipment type', required: true }, { name: 'brand', label: 'Brand' }, { name: 'model', label: 'Model' }, { name: 'serialNumber', label: 'Serial number' }, { name: 'purchaseDate', label: 'Purchase date', type: 'date' }, { name: 'calibrationDate', label: 'Calibration date', type: 'date' }, { name: 'nextCalibrationDate', label: 'Next calibration', type: 'date' }, { name: 'availability', label: 'Availability', type: 'select', options: ['available','assigned','maintenance','calibration_due','retired'] }, { name: 'condition', label: 'Condition' }, { name: 'certificationDocument', label: 'Certification document URL' }] },
  'survey-reports': { singular: 'Survey report', createRoles: ['admin','tenant'], editRoles: ['admin','tenant'], deleteRoles: ['admin','tenant'], statuses: ['draft','internal_review','client_preview','revision_requested','revised','final','locked','cancelled'], columns: [{ path: 'reportNumber', label: 'Report no.' }, { path: 'title', label: 'Report' }, { path: 'project.projectNumber', label: 'Project' }, { path: 'type', label: 'Type' }, { path: 'revisionNumber', label: 'Revision' }, { path: 'issueDate', label: 'Issue date', type: 'date' }, { path: 'status', label: 'Status', type: 'status' }], fields: [{ name: 'project', label: 'Project', type: 'reference', reference: 'survey-projects', required: true }, { name: 'type', label: 'Report type', required: true }, { name: 'templateName', label: 'Template name' }, { name: 'title', label: 'Report title' }, { name: 'sections.summary', label: 'Executive summary', type: 'textarea' }, { name: 'sections.methodology', label: 'Methodology', type: 'textarea' }, { name: 'sections.findings', label: 'Findings', type: 'textarea' }, { name: 'sections.recommendations', label: 'Recommendations', type: 'textarea' }, { name: 'digitalSignature', label: 'Digital signature' }, { name: 'licenceDetails', label: 'Licence details' }, { name: 'issueDate', label: 'Issue date', type: 'date' }, { name: 'status', label: 'Status', type: 'select', options: ['draft','internal_review','client_preview','revision_requested','revised','final','cancelled'] }] },
  'survey-team': { singular: 'Team member', createRoles: ['admin','tenant'], editRoles: ['admin','tenant'], deleteRoles: ['admin','tenant'], statuses: ['invited','active','suspended','removed'], columns: [{ path: 'name', label: 'Member' }, { path: 'email', label: 'Email' }, { path: 'role', label: 'Role', type: 'status' }, { path: 'permissions', label: 'Permissions' }, { path: 'status', label: 'Status', type: 'status' }], fields: [{ name: 'name', label: 'Name', required: true }, { name: 'email', label: 'Email' }, { name: 'phone', label: 'Phone' }, { name: 'role', label: 'Team role', type: 'select', options: ['senior_surveyor','junior_surveyor','field_surveyor','survey_assistant','gis_specialist','drone_operator','quantity_surveyor','valuation_officer','report_reviewer','accountant','project_manager','administrator'] }, { name: 'permissions', label: 'Permissions', type: 'array' }, { name: 'status', label: 'Status', type: 'select', options: ['invited','active','suspended','removed'] }] },
  'survey-clients': { singular: 'Client', createRoles: ['admin','tenant'], editRoles: ['admin','tenant'], deleteRoles: ['admin','tenant'], statuses: ['lead','active','inactive','blocked'], columns: [{ path: 'name', label: 'Client' }, { path: 'type', label: 'Type' }, { path: 'email', label: 'Email' }, { path: 'phone', label: 'Phone' }, { path: 'preferredContact', label: 'Preferred contact' }, { path: 'status', label: 'Status', type: 'status' }], fields: [{ name: 'name', label: 'Client name', required: true }, { name: 'type', label: 'Client type' }, { name: 'email', label: 'Email' }, { name: 'phone', label: 'Phone' }, { name: 'address', label: 'Address', type: 'textarea' }, { name: 'preferredContact', label: 'Preferred contact method' }, { name: 'status', label: 'Status', type: 'select', options: ['lead','active','inactive','blocked'] }, { name: 'notes', label: 'Notes', type: 'array' }] },
  'survey-reviews': { singular: 'Review', createRoles: ['admin','tenant'], editRoles: ['admin','tenant'], deleteRoles: ['admin'], columns: [{ path: 'project.projectNumber', label: 'Project' }, { path: 'client', label: 'Client', type: 'user' }, { path: 'surveyor', label: 'Surveyor', type: 'user' }, { path: 'ratings.overall', label: 'Overall rating' }, { path: 'comment', label: 'Review' }, { path: 'moderation.status', label: 'Moderation', type: 'status' }], fields: [{ name: 'project', label: 'Completed project', type: 'reference', reference: 'survey-projects', required: true }, { name: 'ratings.professionalism', label: 'Professionalism', type: 'number' }, { name: 'ratings.accuracy', label: 'Accuracy', type: 'number' }, { name: 'ratings.communication', label: 'Communication', type: 'number' }, { name: 'ratings.timeliness', label: 'Timeliness', type: 'number' }, { name: 'ratings.reportQuality', label: 'Report quality', type: 'number' }, { name: 'ratings.value', label: 'Value for money', type: 'number' }, { name: 'ratings.overall', label: 'Overall rating', type: 'number' }, { name: 'comment', label: 'Review', type: 'textarea' }, { name: 'response.message', label: 'Surveyor response', type: 'textarea' }] },
  'survey-disputes': { singular: 'Dispute', createRoles: ['admin','tenant'], editRoles: ['admin','tenant'], deleteRoles: ['admin'], statuses: ['submitted','under_review','more_information_required','mediation','resolved','rejected','closed'], columns: [{ path: 'project.projectNumber', label: 'Project' }, { path: 'category', label: 'Category' }, { path: 'raisedBy', label: 'Raised by', type: 'user' }, { path: 'against', label: 'Against', type: 'user' }, { path: 'status', label: 'Status', type: 'status' }, { path: 'createdAt', label: 'Raised', type: 'date' }], fields: [{ name: 'project', label: 'Project', type: 'reference', reference: 'survey-projects', required: true }, { name: 'category', label: 'Complaint category', required: true }, { name: 'description', label: 'Description', type: 'textarea', required: true }, { name: 'evidence', label: 'Evidence URLs', type: 'array' }, { name: 'requestedResolution', label: 'Requested resolution', type: 'textarea' }, { name: 'adminNotes', label: 'Admin notes', type: 'textarea' }, { name: 'finalDecision', label: 'Final decision', type: 'textarea' }] },
  'survey-promotions': { singular: 'Promotion', createRoles: ['admin','tenant'], editRoles: ['admin'], deleteRoles: ['admin'], statuses: ['pending','active','paused','expired','cancelled'], columns: [{ path: 'type', label: 'Promotion' }, { path: 'service.title', label: 'Service' }, { path: 'startsAt', label: 'Starts', type: 'date' }, { path: 'endsAt', label: 'Ends', type: 'date' }, { path: 'amount', label: 'Amount', type: 'money' }, { path: 'status', label: 'Status', type: 'status' }], fields: [{ name: 'service', label: 'Service', type: 'reference', reference: 'survey-services' }, { name: 'type', label: 'Promotion type', type: 'select', options: ['featured_profile','top_placement','verified_badge','recommended_badge','location_promotion','category_promotion','urgent_badge','sponsored_service'] }, { name: 'startsAt', label: 'Start date', type: 'date' }, { name: 'endsAt', label: 'End date', type: 'date' }, { name: 'amount', label: 'Amount', type: 'number' }, { name: 'status', label: 'Status', type: 'select', options: ['pending','active','paused','expired','cancelled'] }] },
 };

Object.assign(configs, {
  applications: { singular:'Rental application', createRoles:['admin','manager','tenant'], editRoles:['admin','manager','landlord','tenant'], deleteRoles:['admin','tenant'], statuses:['draft','submitted','under_review','shortlisted','interview_requested','interview_scheduled','site_visit_scheduled','additional_documents_requested','approved','rejected','waiting_list','withdrawn','agreement_pending','deposit_pending','completed'], columns:[{path:'applicationNumber',label:'Application'},{path:'applicant',label:'Applicant',type:'user'},{path:'property',label:'Property',type:'property'},{path:'targetSpace.name',label:'Room / unit'},{path:'occupantSummary.total',label:'Occupants'},{path:'moveInDate',label:'Move in',type:'date'},{path:'status',label:'Status',type:'status'}], fields:[{name:'property',label:'Property',type:'reference',reference:'properties',required:true},{name:'targetSpace',label:'Apartment / room / bed',type:'reference',reference:'property-spaces'},{name:'occupantSummary.total',label:'Total occupants',type:'number',required:true},{name:'occupantSummary.adults',label:'Adults',type:'number'},{name:'occupantSummary.children',label:'Children',type:'number'},{name:'occupantSummary.seniorCitizens',label:'Senior citizens',type:'number'},{name:'occupantSummary.male',label:'Male occupants',type:'number'},{name:'occupantSummary.female',label:'Female occupants',type:'number'},{name:'occupantSummary.familyStatus',label:'Family / bachelor status'},{name:'occupantIds',label:'Occupants',type:'array'},{name:'moveInDate',label:'Expected move-in',type:'date'},{name:'expectedStayMonths',label:'Expected stay (months)',type:'number'},{name:'monthlyIncome',label:'Monthly income',type:'number'},{name:'rentalBudget',label:'Rental budget',type:'number'},{name:'messageToLandlord',label:'Message to landlord',type:'textarea'},{name:'status',label:'Status',type:'select',options:['draft','submitted','under_review','shortlisted','interview_requested','interview_scheduled','site_visit_scheduled','additional_documents_requested','approved','rejected','waiting_list','withdrawn','agreement_pending','deposit_pending','completed']}] },
  properties: {
    singular: 'Property', createRoles: ['admin','tenant'], editRoles: ['admin','manager','tenant'], deleteRoles: ['admin','tenant'],
    statuses: ['draft','pending_approval','available','partially_occupied','occupied','reserved','rented','sold','leased','maintenance','unavailable','archived'],
    columns: [{path:'referenceNumber',label:'Reference'},{path:'title',label:'Property'},{path:'type',label:'Type'},{path:'purpose',label:'Purpose',type:'status'},{path:'address.city',label:'City'},{path:'visibility',label:'Visibility',type:'status'},{path:'status',label:'Status',type:'status'}],
    fields: [
      {name:'title',label:'Property title',required:true},{name:'referenceNumber',label:'Reference number'},{name:'description',label:'Description',type:'textarea'},
      {name:'type',label:'Property type',required:true},{name:'customType',label:'Custom property type'},{name:'hierarchyMode',label:'Hierarchy mode',type:'select',options:['simple','building','apartment_building','pg_hostel','commercial','land']},
      {name:'purpose',label:'Purpose',type:'select',options:['rent','sale','lease'],required:true},{name:'visibility',label:'Visibility',type:'select',options:['private','public'],required:true},{name:'publicationStatus',label:'Publication',type:'select',options:['draft','published','archived']},
      {name:'status',label:'Status',type:'select',options:['draft','pending_approval','available','partially_occupied','occupied','reserved','rented','sold','leased','maintenance','unavailable','archived']},
      {name:'pricing.salePrice',label:'Sale price',type:'number'},{name:'pricing.monthlyRent',label:'Monthly rent',type:'number'},{name:'pricing.leaseAmount',label:'Lease amount',type:'number'},{name:'pricing.securityDeposit',label:'Security deposit',type:'number'},{name:'pricing.maintenanceCharge',label:'Maintenance charge',type:'number'},{name:'pricing.negotiable',label:'Negotiable',type:'boolean'},
      {name:'areas.total.value',label:'Total area',type:'number'},{name:'areas.total.unit',label:'Area unit'},{name:'areas.carpet.value',label:'Carpet area',type:'number'},{name:'areas.builtUp.value',label:'Built-up area',type:'number'},{name:'areas.plot.value',label:'Plot area',type:'number'},
      {name:'roomDetails.totalApartments',label:'Total apartments',type:'number'},{name:'roomDetails.totalRooms',label:'Total rooms',type:'number'},{name:'roomDetails.bedrooms',label:'Bedrooms',type:'number'},{name:'roomDetails.masterBedrooms',label:'Master bedrooms',type:'number'},{name:'roomDetails.bathrooms',label:'Bathrooms',type:'number'},{name:'roomDetails.toilets',label:'Toilets',type:'number'},{name:'roomDetails.kitchens',label:'Kitchens',type:'number'},{name:'roomDetails.livingRooms',label:'Living rooms',type:'number'},{name:'roomDetails.diningRooms',label:'Dining rooms',type:'number'},{name:'roomDetails.balconies',label:'Balconies',type:'number'},{name:'roomDetails.parkingSpaces',label:'Parking spaces',type:'number'},
      {name:'furnishing.status',label:'Furnishing',type:'select',options:['unfurnished','semi_furnished','fully_furnished']},{name:'furnishing.items',label:'Furniture items',type:'array'},
      {name:'occupancyRules.maxTotal',label:'Maximum occupants',type:'number'},{name:'occupancyRules.maxAdults',label:'Maximum adults',type:'number'},{name:'occupancyRules.maxChildren',label:'Maximum children',type:'number'},{name:'occupancyRules.familyAllowed',label:'Families allowed',type:'boolean'},{name:'occupancyRules.bachelorsAllowed',label:'Bachelors allowed',type:'boolean'},{name:'occupancyRules.studentsAllowed',label:'Students allowed',type:'boolean'},{name:'occupancyRules.petsAllowed',label:'Pets allowed',type:'boolean'},
      {name:'address.line1',label:'Full address'},{name:'address.locality',label:'Locality'},{name:'address.city',label:'City',required:true},{name:'address.district',label:'District'},{name:'address.state',label:'State'},{name:'address.postalCode',label:'Postal code'},{name:'address.landmark',label:'Landmark'},
      {name:'map.latitude',label:'Latitude',type:'number'},{name:'map.longitude',label:'Longitude',type:'number'},{name:'locationPrivacy',label:'Location privacy',type:'select',options:['exact_public','approximate_public','after_application','after_visit_approval','selected_users']},
      {name:'amenities',label:'Amenities',type:'array'},{name:'galleryCover',label:'Cover image URL'},{name:'ageDetails.constructionYear',label:'Construction year',type:'number'},{name:'ageDetails.renovationYear',label:'Renovation year',type:'number'},{name:'ageDetails.availableFrom',label:'Available from',type:'date'},
      {name:'promotion.featured',label:'Featured',type:'boolean'},{name:'promotion.topListing',label:'Top listing',type:'boolean'},{name:'promotion.urgentType',label:'Urgency badge',type:'select',options:['none','urgent_sale','urgent_rent','immediate_possession','available_now','price_reduced']},
    ],
  },
  'property-spaces': { singular:'Property space', createRoles:['admin','manager','landlord','tenant'], editRoles:['admin','manager','landlord','tenant'], deleteRoles:['admin','manager','landlord','tenant'], statuses:['draft','available','reserved','occupied','rented','sold','leased','maintenance','inactive','archived'], columns:[{path:'name',label:'Space'},{path:'property',label:'Property',type:'property'},{path:'level',label:'Level',type:'status'},{path:'purpose',label:'Purpose',type:'status'},{path:'price',label:'Price',type:'money'},{path:'visibility',label:'Visibility',type:'status'},{path:'status',label:'Status',type:'status'}], fields:[{name:'property',label:'Property',type:'reference',reference:'properties',required:true},{name:'parent',label:'Parent space',type:'reference',reference:'property-spaces'},{name:'level',label:'Level',type:'select',options:['building','floor','apartment','room','bed','office','shop','showroom','warehouse_unit','plot','other'],required:true},{name:'name',label:'Name / number',required:true},{name:'code',label:'Code'},{name:'roomNumber',label:'Room number'},{name:'apartmentNumber',label:'Apartment number'},{name:'galleryScope',label:'Gallery scope',type:'select',options:['property','apartment','room']},{name:'floorNumber',label:'Floor number'},{name:'description',label:'Description',type:'textarea'},{name:'status',label:'Status',type:'select',options:['draft','available','reserved','occupied','rented','sold','leased','maintenance','inactive','archived']},{name:'rentable',label:'Rentable',type:'boolean'},{name:'sellable',label:'Sellable',type:'boolean'},{name:'purpose',label:'Purpose',type:'select',options:['rent','sale','lease']},{name:'visibility',label:'Visibility',type:'select',options:['private','public']},{name:'publicationStatus',label:'Publication',type:'select',options:['draft','published','archived']},{name:'price',label:'Price',type:'number'},{name:'securityDeposit',label:'Security deposit',type:'number'},{name:'maintenanceCharge',label:'Maintenance charge',type:'number'},{name:'area.value',label:'Area',type:'number'},{name:'area.unit',label:'Area unit'},{name:'roomDetails.bedrooms',label:'Bedrooms',type:'number'},{name:'roomDetails.bathrooms',label:'Bathrooms',type:'number'},{name:'occupancyRules.maxTotal',label:'Maximum occupants',type:'number'},{name:'occupancyRules.familyAllowed',label:'Family allowed',type:'boolean'},{name:'occupancyRules.bachelorsAllowed',label:'Bachelors allowed',type:'boolean'},{name:'occupancyRules.sharedOccupancyAllowed',label:'Shared occupancy',type:'boolean'},{name:'occupancyRules.petsAllowed',label:'Pets allowed',type:'boolean'},{name:'amenities',label:'Amenities',type:'array'},{name:'coverImage',label:'Cover image URL'},{name:'availableFrom',label:'Available from',type:'date'}] },
  'property-media': { singular:'Gallery item', createRoles:['admin','manager','landlord','tenant'], editRoles:['admin','manager','landlord','tenant'], deleteRoles:['admin','manager','landlord','tenant'], columns:[{path:'caption',label:'Media'},{path:'property',label:'Property',type:'property'},{path:'space.name',label:'Room / area'},{path:'category',label:'Category',type:'status'},{path:'mediaType',label:'Type',type:'status'},{path:'visibility',label:'Visibility',type:'status'},{path:'cover',label:'Cover',type:'boolean'}], fields:[{name:'property',label:'Property',type:'reference',reference:'properties',required:true},{name:'space',label:'Room / space',type:'reference',reference:'property-spaces'},{name:'category',label:'Gallery category',required:true},{name:'mediaType',label:'Media type',type:'select',options:['image','video','360','document']},{name:'file',label:'Upload image',type:'image',required:true},{name:'caption',label:'Caption'},{name:'altText',label:'Alt text'},{name:'sortOrder',label:'Sort order',type:'number'},{name:'cover',label:'Cover image',type:'boolean'},{name:'visibility',label:'Visibility',type:'select',options:['private','public','tenant','manager','surveyor','legal']},{name:'watermark.enabled',label:'Watermark',type:'boolean'},{name:'watermark.text',label:'Watermark text'}] },
  'tenant-profiles': { singular:'Tenant profile', createRoles:['admin','tenant'], editRoles:['admin','tenant'], deleteRoles:['admin'], columns:[{path:'user',label:'Tenant',type:'user'},{path:'occupation',label:'Occupation'},{path:'monthlyIncome',label:'Income',type:'money'},{path:'preferredLocation',label:'Preferred location'},{path:'rentalBudget.max',label:'Budget',type:'money'}], fields:[{name:'profileImage',label:'Profile image URL'},{name:'profileVisibility',label:'Profile visibility',type:'select',options:['private','applications','landlords']},{name:'dateOfBirth',label:'Date of birth',type:'date'},{name:'gender',label:'Gender'},{name:'currentAddress.line1',label:'Current address'},{name:'permanentAddress.line1',label:'Permanent address'},{name:'occupation',label:'Occupation'},{name:'employerInstitution',label:'Employer / institution'},{name:'monthlyIncome',label:'Monthly income',type:'number'},{name:'emergencyContact.name',label:'Emergency contact name'},{name:'emergencyContact.phone',label:'Emergency phone'},{name:'preferredLocation',label:'Preferred location'},{name:'preferredPropertyTypes',label:'Preferred property types',type:'array'},{name:'rentalBudget.min',label:'Minimum budget',type:'number'},{name:'rentalBudget.max',label:'Maximum budget',type:'number'},{name:'moveInDate',label:'Move-in date',type:'date'}] },
  'tenant-kyc': { singular:'Tenant KYC', createRoles:['tenant'], editRoles:['admin','manager','tenant'], deleteRoles:['admin'], statuses:['not_started','incomplete','submitted','under_review','changes_required','verified','rejected','expired','suspended'], columns:[{path:'user',label:'Tenant',type:'user'},{path:'status',label:'Status',type:'status'},{path:'submittedAt',label:'Submitted',type:'date'},{path:'verifiedAt',label:'Verified',type:'date'},{path:'expiresAt',label:'Expires',type:'date'},{path:'reason',label:'Reason'}], fields:[{name:'governmentId',label:'Government ID document ID'},{name:'addressProof',label:'Address proof document ID'},{name:'profilePhoto',label:'Profile photo URL'},{name:'selfiePhoto',label:'Selfie URL'},{name:'employmentProof',label:'Employment / student proof ID'},{name:'phoneVerified',label:'Phone verified',type:'boolean'},{name:'emailVerified',label:'Email verified',type:'boolean'},{name:'status',label:'Status',type:'select',options:['not_started','incomplete','submitted','under_review','changes_required','verified','rejected','expired','suspended']},{name:'reason',label:'Review reason',type:'textarea'},{name:'expiresAt',label:'Expiry date',type:'date'}] },
  occupants: { singular:'Occupant', createRoles:['admin','tenant'], editRoles:['admin','tenant'], deleteRoles:['admin','tenant'], columns:[{path:'fullName',label:'Occupant'},{path:'relationship',label:'Relationship'},{path:'age',label:'Age'},{path:'gender',label:'Gender'},{path:'occupation',label:'Occupation'},{path:'kycStatus',label:'KYC',type:'status'}], fields:[{name:'fullName',label:'Full name',required:true},{name:'age',label:'Age',type:'number'},{name:'gender',label:'Gender'},{name:'relationship',label:'Relationship'},{name:'occupation',label:'Occupation'},{name:'phone',label:'Phone'},{name:'identityDocument',label:'Identity document ID'},{name:'kycStatus',label:'KYC status',type:'select',options:['not_started','submitted','verified','rejected']}] },
  'tenant-interviews': { singular:'Tenant interview', createRoles:['admin','manager','tenant'], editRoles:['admin','manager','tenant'], deleteRoles:['admin','manager'], statuses:['requested','scheduled','rescheduled','completed','cancelled','tenant_absent','landlord_absent'], columns:[{path:'application.applicationNumber',label:'Application'},{path:'tenant',label:'Tenant',type:'user'},{path:'property',label:'Property',type:'property'},{path:'scheduledAt',label:'Scheduled',type:'date'},{path:'type',label:'Type',type:'status'},{path:'decision',label:'Decision',type:'status'},{path:'status',label:'Status',type:'status'}], fields:[{name:'application',label:'Application',type:'reference',reference:'applications',required:true},{name:'scheduledAt',label:'Scheduled date'},{name:'type',label:'Interview type',type:'select',options:['online','in_person','phone']},{name:'location',label:'Location'},{name:'meetingUrl',label:'Meeting link'},{name:'privateNotes',label:'Private notes',type:'textarea'},{name:'rating',label:'Rating',type:'number'},{name:'decision',label:'Decision',type:'select',options:['pending','shortlist','approve','reject','waiting_list']},{name:'followUpAt',label:'Follow-up date',type:'date'},{name:'status',label:'Status',type:'select',options:['requested','scheduled','rescheduled','completed','cancelled','tenant_absent','landlord_absent']}] },
  'property-visits': { singular:'Property visit', createRoles:['admin','manager','tenant'], editRoles:['admin','manager','tenant'], deleteRoles:['admin','tenant'], statuses:['requested','pending_approval','approved','rescheduled','confirmed','visitor_arrived','visit_in_progress','completed','customer_absent','landlord_absent','cancelled','rejected'], columns:[{path:'property',label:'Property',type:'property'},{path:'requester',label:'Visitor',type:'user'},{path:'preferredStart',label:'Preferred',type:'date'},{path:'confirmedStart',label:'Confirmed',type:'date'},{path:'visitorCount',label:'Visitors'},{path:'status',label:'Status',type:'status'}], fields:[{name:'property',label:'Property',type:'reference',reference:'properties',required:true},{name:'space',label:'Room / space',type:'reference',reference:'property-spaces'},{name:'preferredStart',label:'Preferred date and time'},{name:'visitorCount',label:'Visitors',type:'number'},{name:'purpose',label:'Purpose'},{name:'message',label:'Message',type:'textarea'},{name:'accessibilitySupport',label:'Accessibility support'},{name:'proposedStart',label:'Proposed date and time'},{name:'confirmedStart',label:'Confirmed date and time'},{name:'instructions',label:'Instructions',type:'textarea'},{name:'meetingPoint',label:'Meeting point'},{name:'status',label:'Status',type:'select',options:['requested','pending_approval','approved','rescheduled','confirmed','visitor_arrived','visit_in_progress','completed','customer_absent','landlord_absent','cancelled','rejected']}] },
  tenancies: { singular:'Tenancy', createRoles:['admin','manager','landlord','tenant'], editRoles:['admin','manager','landlord','tenant'], deleteRoles:['admin','landlord'], statuses:['reserved','deposit_pending','agreement_pending','active','notice','move_out','completed','cancelled'], columns:[{path:'tenant',label:'Tenant',type:'user'},{path:'property',label:'Property',type:'property'},{path:'space.name',label:'Room / unit'},{path:'monthlyRent',label:'Monthly rent',type:'money'},{path:'dueDay',label:'Due day'},{path:'dueTime',label:'Due time'},{path:'startDate',label:'Starts',type:'date'},{path:'endDate',label:'Ends',type:'date'},{path:'status',label:'Status',type:'status'}], fields:[{name:'tenant',label:'Tenant',type:'reference',reference:'users',required:true},{name:'property',label:'Property',type:'reference',reference:'properties',required:true},{name:'space',label:'Room / space',type:'reference',reference:'property-spaces'},{name:'application',label:'Application',type:'reference',reference:'applications'},{name:'status',label:'Status',type:'select',options:['reserved','deposit_pending','agreement_pending','active','notice','move_out','completed','cancelled']},{name:'startDate',label:'Start date',type:'date'},{name:'endDate',label:'End date',type:'date'},{name:'monthlyRent',label:'Monthly rent',type:'number'},{name:'securityDeposit',label:'Security deposit',type:'number'},{name:'dueDay',label:'Monthly due day (1–31)',type:'number'},{name:'dueTime',label:'Monthly due time',type:'time'}] },
  'rental-invoices': { singular:'Rental invoice', createRoles:['admin','manager','landlord','tenant'], editRoles:['admin','manager','landlord','tenant'], deleteRoles:['admin','landlord'], statuses:['upcoming','pending','partially_paid','paid','overdue','failed','refunded','waived','disputed'], columns:[{path:'invoiceNumber',label:'Invoice'},{path:'tenant',label:'Tenant',type:'user'},{path:'property',label:'Property',type:'property'},{path:'billingMonth',label:'Month'},{path:'totalAmount',label:'Total',type:'money'},{path:'balanceAmount',label:'Balance',type:'money'},{path:'dueDate',label:'Due',type:'date'},{path:'status',label:'Status',type:'status'}], fields:[{name:'tenancy',label:'Tenancy',type:'reference',reference:'tenancies',required:true},{name:'billingMonth',label:'Billing month',required:true},{name:'dueDate',label:'Due date',type:'date',required:true},{name:'charges.baseRent',label:'Base rent',type:'number'},{name:'charges.electricity',label:'Electricity',type:'number'},{name:'charges.water',label:'Water',type:'number'},{name:'charges.maintenance',label:'Maintenance',type:'number'},{name:'charges.parking',label:'Parking',type:'number'},{name:'charges.internet',label:'Internet',type:'number'},{name:'charges.gas',label:'Gas',type:'number'},{name:'charges.cleaning',label:'Cleaning',type:'number'},{name:'charges.commonArea',label:'Common area',type:'number'},{name:'charges.securityDeposit',label:'Security deposit',type:'number'},{name:'charges.lateFee',label:'Late fee',type:'number'},{name:'discounts',label:'Discounts',type:'number'},{name:'previousBalance',label:'Previous balance',type:'number'},{name:'paidAmount',label:'Paid amount',type:'number'},{name:'status',label:'Status',type:'select',options:['upcoming','pending','partially_paid','paid','overdue','failed','refunded','waived','disputed']}] },
  'utility-readings': { singular:'Utility reading', createRoles:['admin','manager','landlord','tenant'], editRoles:['admin','manager','landlord','tenant'], deleteRoles:['admin','landlord'], columns:[{path:'utilityType',label:'Utility',type:'status'},{path:'property',label:'Property',type:'property'},{path:'tenant',label:'Tenant',type:'user'},{path:'billingPeriod',label:'Period'},{path:'unitsConsumed',label:'Units'},{path:'totalAmount',label:'Amount',type:'money'},{path:'dueDate',label:'Due',type:'date'}], fields:[{name:'property',label:'Property',type:'reference',reference:'properties',required:true},{name:'tenancy',label:'Tenancy',type:'reference',reference:'tenancies',required:true},{name:'space',label:'Room / space',type:'reference',reference:'property-spaces'},{name:'tenant',label:'Tenant',type:'reference',reference:'users'},{name:'utilityType',label:'Utility',type:'select',options:['electricity','water'],required:true},{name:'billingPeriod',label:'Billing period',required:true},{name:'previousReading',label:'Previous reading',type:'number'},{name:'currentReading',label:'Current reading',type:'number'},{name:'unitsConsumed',label:'Units consumed',type:'number'},{name:'ratePerUnit',label:'Rate per unit',type:'number'},{name:'fixedCharge',label:'Fixed charge',type:'number'},{name:'tax',label:'Tax',type:'number'},{name:'otherCharge',label:'Other charge',type:'number'},{name:'totalAmount',label:'Total amount',type:'number'},{name:'allocationMethod',label:'Allocation',type:'select',options:['direct','equal_room','equal_tenant','occupants','percentage','custom','sub_meter']},{name:'allocations',label:'Allocations JSON',type:'json'},{name:'meterPhoto',label:'Meter photo file ID'},{name:'billDocument',label:'Bill document file ID'},{name:'dueDate',label:'Due date',type:'date'},{name:'approved',label:'Approved',type:'boolean'}] },
  'reminder-rules': { singular:'Reminder rule', createRoles:['admin','manager','tenant'], editRoles:['admin','manager','tenant'], deleteRoles:['admin','tenant'], columns:[{path:'eventType',label:'Event'},{path:'property',label:'Property',type:'property'},{path:'offsetsDays',label:'Schedule'},{path:'channels',label:'Channels'},{path:'repeatWeeklyUntilPaid',label:'Repeat',type:'boolean'},{path:'active',label:'Active',type:'boolean'}], fields:[{name:'property',label:'Property',type:'reference',reference:'properties'},{name:'eventType',label:'Event type',required:true},{name:'offsetsDays',label:'Reminder days (e.g. -7,-3,-1,0,1,3,7)',type:'array'},{name:'channels',label:'Channels',type:'array'},{name:'repeatWeeklyUntilPaid',label:'Repeat weekly until paid',type:'boolean'},{name:'template.subject',label:'Subject'},{name:'template.message',label:'Message',type:'textarea'},{name:'active',label:'Active',type:'boolean'}] },
  'property-promotions': { singular:'Property promotion', createRoles:['admin','tenant'], editRoles:['admin','tenant'], deleteRoles:['admin'], statuses:['pending','active','paused','expired','cancelled'], columns:[{path:'property',label:'Property',type:'property'},{path:'type',label:'Promotion',type:'status'},{path:'startsAt',label:'Starts',type:'date'},{path:'endsAt',label:'Ends',type:'date'},{path:'amount',label:'Amount',type:'money'},{path:'status',label:'Status',type:'status'}], fields:[{name:'property',label:'Property',type:'reference',reference:'properties',required:true},{name:'space',label:'Room / space',type:'reference',reference:'property-spaces'},{name:'type',label:'Promotion type',type:'select',options:['featured','top_listing','urgent_sale','urgent_rent','homepage_banner','recommended','location_sponsored'],required:true},{name:'startsAt',label:'Start date',type:'date'},{name:'endsAt',label:'End date',type:'date'},{name:'amount',label:'Amount',type:'number'},{name:'status',label:'Status',type:'select',options:['pending','active','paused','expired','cancelled']}] },
  'site-enquiries': { singular:'Site enquiry', createRoles:[], editRoles:['admin','manager'], deleteRoles:['admin'], statuses:['new','contacted','qualified','closed','spam'], columns:[{path:'name',label:'Name'},{path:'email',label:'Email'},{path:'phone',label:'Phone'},{path:'type',label:'Type',type:'status'},{path:'preferredCallbackAt',label:'Callback time',type:'date'},{path:'callbackWindow',label:'Callback window'},{path:'property',label:'Property',type:'property'},{path:'status',label:'Status',type:'status'},{path:'createdAt',label:'Received',type:'date'}], fields:[{name:'preferredCallbackAt',label:'Preferred callback time',type:'datetime'},{name:'callbackWindow',label:'Preferred callback window'},{name:'status',label:'Status',type:'select',options:['new','contacted','qualified','closed','spam']},{name:'assignedTo',label:'Assigned to',type:'reference',reference:'users'}] },


  'landlord-plans': {
    singular:'Landlord plan', createRoles:['admin'], editRoles:['admin'], deleteRoles:['admin'],
    columns:[{path:'name',label:'Plan'},{path:'limits.properties',label:'Properties'},{path:'limits.buildings',label:'Buildings'},{path:'limits.apartments',label:'Apartments'},{path:'limits.rooms',label:'Rooms'},{path:'limits.beds',label:'Beds'},{path:'limits.publicListings',label:'Public listings'},{path:'limits.activeTenants',label:'Active tenants'},{path:'limits.storageMB',label:'Vault MB'},{path:'features.apiAccess',label:'API access',type:'boolean'},{path:'features.prioritySupport',label:'Priority support',type:'boolean'},{path:'prices.monthly',label:'Monthly price',type:'money'},{path:'prices.yearly',label:'Yearly price',type:'money'}],
    fields:[
      {name:'name',label:'Plan name',required:true},
      {name:'limits.properties',label:'Number of properties they can list',type:'number',required:true},
      {name:'limits.buildings',label:'Number of buildings they can manage',type:'number',required:true},
      {name:'limits.apartments',label:'Number of apartments they can manage',type:'number',required:true},
      {name:'limits.rooms',label:'Number of rooms they can manage',type:'number',required:true},
      {name:'limits.beds',label:'Number of beds they can manage',type:'number',required:true},
      {name:'limits.publicListings',label:'Number of public listings they can publish',type:'number',required:true},
      {name:'limits.activeTenants',label:'Number of active tenants they can manage',type:'number',required:true},
      {name:'limits.storageMB',label:'Total Vault storage (MB)',type:'number',required:true},
      {name:'features.apiAccess',label:'API access',type:'radio',options:['true','false']},
      {name:'features.prioritySupport',label:'Priority support',type:'radio',options:['true','false']},
      {name:'billingCycle',label:'Plan billing',type:'select',options:['monthly','yearly'],required:true},
      {name:'price',label:'Price (INR)',type:'number',required:true},
    ],
  },
  'site-settings': { singular:'Site identity', createRoles:[], editRoles:['admin'], deleteRoles:[], columns:[{path:'siteTitle',label:'Site title'},{path:'shortTitle',label:'Short title'},{path:'tagline',label:'Tagline'}], fields:[{name:'siteTitle',label:'Site title'},{name:'shortTitle',label:'Short title'},{name:'tagline',label:'Tagline'},{name:'description',label:'Description',type:'textarea'},{name:'logoUrl',label:'Logo URL'},{name:'faviconUrl',label:'Favicon URL'},{name:'contact',label:'Contact details',type:'json'},{name:'brand',label:'Brand settings',type:'json'}] },
  'seo-pages': { singular:'SEO page', createRoles:['admin'], editRoles:['admin'], deleteRoles:['admin'], columns:[{path:'path',label:'Path'},{path:'title',label:'Title'},{path:'active',label:'Active',type:'boolean'}], fields:[{name:'path',label:'Path',required:true},{name:'title',label:'Title',required:true},{name:'description',label:'Description',type:'textarea'},{name:'keywords',label:'Keywords',type:'array'},{name:'canonicalUrl',label:'Canonical URL'},{name:'robots',label:'Robots'},{name:'active',label:'Active',type:'boolean'}] },
  'home-carousel': { singular:'Home carousel', createRoles:['admin'], editRoles:['admin'], deleteRoles:['admin'], columns:[{path:'title',label:'Title'},{path:'audience',label:'Audience'},{path:'sortOrder',label:'Order'},{path:'active',label:'Active',type:'boolean'}], fields:[{name:'title',label:'Title',required:true},{name:'subtitle',label:'Subtitle'},{name:'eyebrow',label:'Eyebrow'},{name:'imageUrl',label:'Desktop carousel image',type:'image'},{name:'mobileImageUrl',label:'Mobile carousel image',type:'image'},{name:'primaryCta',label:'Primary CTA',type:'json'},{name:'secondaryCta',label:'Secondary CTA',type:'json'},{name:'sortOrder',label:'Sort order',type:'number'},{name:'active',label:'Active',type:'boolean'},{name:'audience',label:'Audience',type:'select',options:['all','tenant','landlord','surveyor']}] },
  'home-sections': { singular:'Home section', createRoles:['admin'], editRoles:['admin'], deleteRoles:['admin'], columns:[{path:'key',label:'Key'},{path:'type',label:'Type'},{path:'title',label:'Title'},{path:'sortOrder',label:'Order'},{path:'active',label:'Active',type:'boolean'}], fields:[{name:'key',label:'Key',required:true},{name:'type',label:'Type',type:'select',options:['stats','features','featured_properties','featured_surveyors','locations','testimonials','cta','custom']},{name:'title',label:'Title'},{name:'subtitle',label:'Subtitle'},{name:'content',label:'Content',type:'json'},{name:'sortOrder',label:'Sort order',type:'number'},{name:'active',label:'Active',type:'boolean'}] },
  'property-type-configs': { singular:'Property type', createRoles:['admin'], editRoles:['admin'], deleteRoles:['admin'], columns:[{path:'label',label:'Label'},{path:'key',label:'Key'},{path:'category',label:'Category'},{path:'active',label:'Active',type:'boolean'}], fields:[{name:'key',label:'Key',required:true},{name:'label',label:'Label',required:true},{name:'category',label:'Category',type:'select',options:['residential','commercial','land','hospitality','event','other']},{name:'hierarchyMode',label:'Hierarchy mode',type:'select',options:['simple','building','apartment_building','pg_hostel','commercial','land']},{name:'fields',label:'Custom fields',type:'json'},{name:'allowedPurposes',label:'Allowed purposes',type:'array'},{name:'active',label:'Active',type:'boolean'},{name:'sortOrder',label:'Sort order',type:'number'}] },
  'area-units': { singular:'Area unit', createRoles:['admin'], editRoles:['admin'], deleteRoles:['admin'], columns:[{path:'label',label:'Label'},{path:'symbol',label:'Symbol'},{path:'region.country',label:'Country'},{path:'squareMetreFactor',label:'Sq. meter factor'},{path:'active',label:'Active',type:'boolean'}], fields:[{name:'key',label:'Key',required:true},{name:'label',label:'Label',required:true},{name:'symbol',label:'Symbol'},{name:'region',label:'Region',type:'json'},{name:'squareMetreFactor',label:'Square metre factor',type:'number'},{name:'active',label:'Active',type:'boolean'},{name:'sortOrder',label:'Sort order',type:'number'}] },

  subscriptions: { singular:'Subscription', createRoles:[], editRoles:['admin'], deleteRoles:['admin'], statuses:['pending','active','expired','cancelled','past_due'], columns:[{path:'user',label:'User',type:'user'},{path:'plan',label:'Plan'},{path:'status',label:'Status',type:'status'},{path:'startedAt',label:'Started',type:'date'},{path:'expiresAt',label:'Expires',type:'date'}], fields:[{name:'status',label:'Status',type:'select',options:['pending','active','expired','cancelled','past_due']},{name:'expiresAt',label:'Expiry date',type:'date'}] },
  'notification-preferences': { singular:'Notification preference', createRoles:[], editRoles:['admin'], deleteRoles:[], columns:[{path:'user',label:'User',type:'user'},{path:'channels.whatsapp',label:'WhatsApp',type:'boolean'},{path:'channels.sms',label:'SMS',type:'boolean'},{path:'channels.email',label:'Email',type:'boolean'}], fields:[{name:'channels',label:'Channels',type:'json'},{name:'categories',label:'Categories',type:'json'},{name:'quietHours',label:'Quiet hours',type:'json'}] },
  'notification-deliveries': { singular:'Notification delivery', createRoles:[], editRoles:['admin'], deleteRoles:['admin'], statuses:['pending','sent','failed','skipped'], columns:[{path:'user',label:'User',type:'user'},{path:'channel',label:'Channel',type:'status'},{path:'destination',label:'Destination'},{path:'status',label:'Status',type:'status'},{path:'attempts',label:'Attempts'},{path:'sentAt',label:'Sent',type:'date'},{path:'lastError',label:'Last error'}], fields:[{name:'status',label:'Status',type:'select',options:['pending','sent','failed','skipped']},{name:'nextAttemptAt',label:'Next attempt',type:'datetime'},{name:'lastError',label:'Last error',type:'textarea'},{name:'metadata',label:'Metadata',type:'json'}] },
  'platform-modules': { singular:'Platform module', createRoles:['admin'], editRoles:['admin'], deleteRoles:['admin'], columns:[{path:'label',label:'Module'},{path:'key',label:'Key'},{path:'scope',label:'Scope',type:'status'},{path:'section',label:'Section'},{path:'path',label:'Path'},{path:'enabled',label:'Enabled',type:'boolean'}], fields:[{name:'key',label:'Module key',required:true},{name:'label',label:'Display label',required:true},{name:'description',label:'Description',type:'textarea'},{name:'path',label:'Route path',required:true},{name:'icon',label:'Icon key'},{name:'scope',label:'Scope',type:'select',options:['public','app'],required:true},{name:'kind',label:'Kind',type:'select',options:['page','resource','system','external']},{name:'section',label:'Navigation section',type:'select',options:['overview','administration','property_management','rental_operations','survey_management','finance','communication','system','general']},{name:'sectionOrder',label:'Section order',type:'number'},{name:'roles',label:'Legacy role access',type:'array'},{name:'modes',label:'Legacy mode access',type:'array'},{name:'accessRules',label:'Role and mode access rules',type:'json'},{name:'enabled',label:'Enabled',type:'boolean'},{name:'mobilePrimary',label:'Mobile primary item',type:'boolean'},{name:'sortOrder',label:'Sort order',type:'number'},{name:'featureFlag',label:'Required feature flag'},{name:'badge',label:'Badge configuration',type:'json'},{name:'metadata',label:'Additional metadata',type:'json'}] },
  'content-pages': { singular:'Content page', createRoles:['admin'], editRoles:['admin'], deleteRoles:['admin'], columns:[{path:'title',label:'Page title'},{path:'path',label:'Path'},{path:'footer.enabled',label:'Footer',type:'boolean'},{path:'footer.sortOrder',label:'Footer order'},{path:'visibility',label:'Visibility',type:'status'},{path:'active',label:'Active',type:'boolean'},{path:'updatedAt',label:'Updated',type:'date'}], fields:[{name:'path',label:'Public path',required:true},{name:'slug',label:'Slug',required:true},{name:'title',label:'Title',required:true},{name:'subtitle',label:'Subtitle'},{name:'hero',label:'Hero configuration',type:'json'},{name:'sections',label:'Page sections',type:'json'},{name:'footer.enabled',label:'Show in footer',type:'boolean'},{name:'footer.label',label:'Footer label'},{name:'footer.sortOrder',label:'Footer order',type:'number'},{name:'visibility',label:'Visibility',type:'select',options:['public','authenticated']},{name:'active',label:'Active',type:'boolean'}] },
  'integration-settings': { singular:'Integration', createRoles:['admin'], editRoles:['admin'], deleteRoles:['admin'], columns:[{path:'provider',label:'Provider'},{path:'key',label:'Key'},{path:'category',label:'Category',type:'status'},{path:'enabled',label:'Enabled',type:'boolean'},{path:'status',label:'Status',type:'status'},{path:'lastCheckedAt',label:'Last checked',type:'date'}], fields:[{name:'key',label:'Integration key',required:true},{name:'provider',label:'Provider name',required:true},{name:'category',label:'Category',type:'select',options:['storage','payment','email','sms','maps','analytics','identity','other']},{name:'enabled',label:'Enabled',type:'boolean'},{name:'status',label:'Status',type:'select',options:['unconfigured','configured','healthy','degraded','failed','disabled']},{name:'publicConfig',label:'Public configuration',type:'json'},{name:'envRequirements',label:'Required environment variables',type:'array'},{name:'lastError',label:'Last error',type:'textarea'}] },
  facilities: { singular:'Facility', createRoles:['admin','manager','landlord','tenant'], editRoles:['admin','manager','landlord','tenant'], deleteRoles:['admin','manager','landlord','tenant'], statuses:['active','maintenance','inactive','archived'], columns:[{path:'name',label:'Facility'},{path:'property',label:'Property',type:'property'},{path:'type',label:'Type'},{path:'capacity',label:'Capacity'},{path:'price',label:'Price',type:'money'},{path:'visibility',label:'Visibility',type:'status'},{path:'status',label:'Status',type:'status'}], fields:[{name:'property',label:'Property',type:'reference',reference:'properties',required:true},{name:'manager',label:'Facility manager',type:'reference',reference:'users'},{name:'name',label:'Facility name',required:true},{name:'type',label:'Facility type',required:true},{name:'description',label:'Description',type:'textarea'},{name:'capacity',label:'Maximum guests',type:'number'},{name:'visibility',label:'Visibility',type:'select',options:['private','tenant','public']},{name:'status',label:'Status',type:'select',options:['active','maintenance','inactive','archived']},{name:'bookingRequired',label:'Booking required',type:'boolean'},{name:'price',label:'Booking price',type:'number'},{name:'deposit',label:'Security deposit',type:'number'},{name:'slotMinutes',label:'Slot duration (minutes)',type:'number'},{name:'minimumNoticeHours',label:'Minimum notice (hours)',type:'number'},{name:'maximumAdvanceDays',label:'Maximum advance days',type:'number'},{name:'availableDays',label:'Available days',type:'array'},{name:'availableTimeSlots',label:'Time slots (JSON)',type:'json'},{name:'amenities',label:'Amenities',type:'array'},{name:'rules',label:'Rules',type:'array'},{name:'images',label:'Image URLs',type:'array'}] },
  'facility-bookings': { singular:'Facility booking', createRoles:['admin','manager','landlord','tenant'], editRoles:['admin','manager','landlord','tenant'], deleteRoles:['admin','landlord'], statuses:['requested','approved','rescheduled','rejected','cancelled','in_progress','completed','no_show'], columns:[{path:'facility.name',label:'Facility'},{path:'requester',label:'Requested by',type:'user'},{path:'startAt',label:'Starts',type:'date'},{path:'endAt',label:'Ends',type:'date'},{path:'guests',label:'Guests'},{path:'amount',label:'Amount',type:'money'},{path:'paymentStatus',label:'Payment',type:'status'},{path:'status',label:'Status',type:'status'}], fields:[{name:'facility',label:'Facility',type:'reference',reference:'facilities',required:true},{name:'requester',label:'Requester',type:'reference',reference:'users'},{name:'startAt',label:'Start date and time',type:'datetime',required:true},{name:'endAt',label:'End date and time',type:'datetime',required:true},{name:'guests',label:'Number of guests',type:'number'},{name:'purpose',label:'Purpose',type:'textarea'},{name:'notes',label:'Notes',type:'textarea'},{name:'status',label:'Status',type:'select',options:['requested','approved','rescheduled','rejected','cancelled','in_progress','completed','no_show']},{name:'paymentStatus',label:'Payment status',type:'select',options:['not_required','pending','paid','failed','refunded']},{name:'decisionNote',label:'Decision note',type:'textarea'}] },
});

// Property spaces are independent inventory records. Keep the legacy status
// key `sold` readable, while exposing the clearer Sold Out option for new
// room, flat, and apartment records.
const propertySpaceConfig = configs['property-spaces'];
if (propertySpaceConfig && !propertySpaceConfig.statuses?.includes('sold_out')) propertySpaceConfig.statuses = [...(propertySpaceConfig.statuses || []), 'sold_out'];
const propertySpaceStatusField = propertySpaceConfig?.fields.find((field) => field.name === 'status');
if (propertySpaceStatusField && !propertySpaceStatusField.options?.includes('sold_out')) propertySpaceStatusField.options = [...(propertySpaceStatusField.options || []), 'sold_out'];
if (propertySpaceConfig && !propertySpaceConfig.fields.some((field) => field.name === 'flatNumber')) propertySpaceConfig.fields.push({ name: 'flatNumber', label: 'Flat number' });

function getValue(obj: any, path: string) { return path.split('.').reduce((value, key) => value?.[key], obj); }
function setValue(obj: any, path: string, value: any) { const keys = path.split('.'); let current = obj; keys.slice(0, -1).forEach((key) => { current[key] ||= {}; current = current[key]; }); current[keys.at(-1)!] = value; }
function idOf(value: any) { return value && typeof value === 'object' ? value._id || '' : value || ''; }
function isManagedRentalPayment(value: any) {
  return Boolean(value?.rentalInvoice) && value?.type === 'rent' && value?.gateway?.source === 'rental_invoice';
}
function optionLabel(item: any) { return item.title || item.name || item.unitNumber || item.code || item.email || item._id; }
const statusLabels: Record<string, string> = {
  draft: 'Draft', pending_approval: 'Pending Approval', available: 'Available', partially_occupied: 'Partially Occuped', occupied: 'Occupied',
  reserved: 'Reserved', rented: 'Rented', sold: 'Sold', sold_out: 'Sold Out', leased: 'Leased', maintenance: 'Maintenance', unavailable: 'Unavailable', archived: 'Archidved',
};
function optionText(value: any) {
  const raw = String(value || '');
  return statusLabels[raw] || raw.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function formatCell(value: any, type?: Column['type']) {
  if (value === null || value === undefined || value === '') return '—';
  if (type === 'money') return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value));
  if (type === 'date') { const date = new Date(value); return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('en-IN', { dateStyle: 'medium', ...(String(value).includes('T') && { timeStyle: 'short' }) }); }
  if (type === 'user') return typeof value === 'object' ? value.name || value.email || '—' : value;
  if (type === 'property') return typeof value === 'object' ? value.title || value.code || '—' : value;
  if (type === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return value.name || value.title || value.unitNumber || JSON.stringify(value);
  return optionText(value);
}

function formatRecordDate(value: unknown) {
  if (!value) return '—';
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDueTime(value: unknown) {
  const match = String(value || '').match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!match) return String(value || '—');
  const hour = Number(match[1]);
  return `${hour % 12 || 12}:${match[2]} ${hour >= 12 ? 'PM' : 'AM'}`;
}

function planLimitValue(row: any, path: string) {
  const value = getValue(row, path);
  if (value === undefined || value === null || value === '') return '—';
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toLocaleString('en-IN') : String(value);
}

function LandlordPlanResourceAccordion({ row, canEdit, canDelete, onEdit, onRemove }: { row: any; canEdit: boolean; canDelete: boolean; onEdit: () => void; onRemove: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const title = row.name || row.key || 'Untitled landlord plan';
  const cycle = Number(row.prices?.yearly || 0) > 0 && Number(row.prices?.monthly || 0) === 0 ? 'yearly' : 'monthly';
  const price = Number(row.prices?.[cycle] || 0);
  const active = row.active !== false;
  const accent = String(title).toLowerCase().includes('enterprise') ? '#6D4AFF' : String(title).toLowerCase().includes('premium') ? '#B56A00' : '#0B5270';
  const tint = String(title).toLowerCase().includes('enterprise') ? 'rgba(109,74,255,.10)' : String(title).toLowerCase().includes('premium') ? 'rgba(181,106,0,.10)' : 'rgba(11,82,112,.10)';
  const limitGroups = [
    ['Properties', 'limits.properties'], ['Buildings', 'limits.buildings'], ['Apartments', 'limits.apartments'],
    ['Rooms', 'limits.rooms'], ['Beds', 'limits.beds'], ['Public listings', 'limits.publicListings'],
    ['Active tenants', 'limits.activeTenants'], ['Vault storage (MB)', 'limits.storageMB'],
  ];
  const features = [
    ['API access', Boolean(row.features?.apiAccess)], ['Priority support', Boolean(row.features?.prioritySupport)],
  ];

  return <Accordion expanded={expanded} onChange={(_, next) => setExpanded(next)} disableGutters sx={{
    overflow: 'hidden', border: '1px solid rgba(11,82,112,.14)', borderRadius: '18px !important',
    background: 'linear-gradient(145deg, #FFFFFF 0%, #F8FCFD 100%)', boxShadow: expanded ? '0 18px 42px rgba(11,82,112,.13)' : '0 8px 24px rgba(15,42,52,.06)',
    transition: 'box-shadow .22s ease, border-color .22s ease', '&:before': { display: 'none' }, '&:hover': { borderColor: `${accent}66` },
  }}>
    <AccordionSummary expandIcon={<ExpandMoreRounded sx={{ color: accent }} />} sx={{ px: { xs: 1.8, sm: 2.4 }, py: 1, minHeight: 84, '&.Mui-expanded': { minHeight: 84 }, '& .MuiAccordionSummary-content': { my: 1.2, minWidth: 0 } }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1.5} sx={{ width: '100%', minWidth: 0 }}>
        <Stack direction="row" alignItems="center" spacing={1.4} sx={{ minWidth: 0 }}>
          <Box sx={{ width: 48, height: 48, flex: '0 0 auto', display: 'grid', placeItems: 'center', borderRadius: 3, color: accent, bgcolor: tint, boxShadow: `inset 0 0 0 1px ${accent}20` }}><WorkspacePremiumRounded sx={{ fontSize: 25 }} /></Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography fontWeight={950} noWrap sx={{ fontSize: { xs: 15, sm: 17 }, letterSpacing: '-.02em' }}>{title}</Typography>
            <Stack direction="row" spacing={.7} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: .55 }}>
              <Chip size="small" label={`${formatCell(price, 'money')} / ${cycle === 'yearly' ? 'year' : 'month'}`} sx={{ bgcolor: tint, color: accent, fontWeight: 850, border: 'none' }} />
              <Chip size="small" label={active ? 'Active' : 'Inactive'} sx={{ bgcolor: active ? '#E8F7EF' : '#F3F4F6', color: active ? '#23734A' : '#64748B', fontWeight: 800, border: 'none' }} />
            </Stack>
          </Box>
        </Stack>
        {(canEdit || canDelete) && <Stack direction="row" spacing={.4} sx={{ flex: '0 0 auto' }} onClick={(event) => event.stopPropagation()}>
          {canEdit && <IconButton size="small" title="Edit landlord subscription plan" aria-label={`Edit ${title} landlord subscription plan`} onClick={onEdit} sx={{ color: '#0B5270', '&:hover': { bgcolor: '#E4F3F7' } }}><EditRounded fontSize="small" /></IconButton>}
          {canDelete && <IconButton size="small" title="Delete landlord subscription plan" aria-label={`Delete ${title} landlord subscription plan`} onClick={onRemove} sx={{ color: '#C2413B', '&:hover': { bgcolor: '#FDECEA' } }}><DeleteOutlineRounded fontSize="small" /></IconButton>}
        </Stack>}
      </Stack>
    </AccordionSummary>
    <AccordionDetails sx={{ px: { xs: 1.8, sm: 2.4 }, pb: 2.4, pt: 0 }}>
      <Divider sx={{ mb: 2, borderColor: 'rgba(15,42,52,.08)' }} />
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 2fr) minmax(260px, 1fr)' }, gap: 1.5 }}>
        <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 3, borderColor: `${accent}22`, bgcolor: `${tint}` }}>
          <Typography fontWeight={900}>Capacity limits</Typography>
          <Typography color="text.secondary" fontSize={12} sx={{ mt: .35, mb: 1.5 }}>The maximum resources available to landlords on this plan.</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(4, minmax(0, 1fr))' }, gap: 1 }}>
            {limitGroups.map(([label, path]) => <Box key={path} sx={{ p: 1.1, borderRadius: 2.5, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}><Typography color="text.secondary" fontSize={10.5} fontWeight={800}>{label}</Typography><Typography fontWeight={950} sx={{ mt: .25, color: accent }}>{planLimitValue(row, path)}</Typography></Box>)}
          </Box>
        </Paper>
        <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 3, borderColor: 'divider' }}>
          <Typography fontWeight={900}>Plan features</Typography>
          <Stack spacing={1.1} sx={{ mt: 1.5 }}>
            {features.map(([label, enabled]) => <Stack direction="row" justifyContent="space-between" alignItems="center" key={String(label)}><Typography fontSize={12.5}>{label}</Typography><Chip size="small" label={enabled ? 'Included' : 'Not included'} color={enabled ? 'success' : 'default'} variant={enabled ? 'filled' : 'outlined'} /></Stack>)}
            <Divider />
            <Stack direction="row" justifyContent="space-between" alignItems="center"><Typography fontSize={12.5}>Billing cycle</Typography><Typography fontWeight={850}>{optionText(cycle)}</Typography></Stack>
            <Stack direction="row" justifyContent="space-between" alignItems="center" gap={2}><Typography fontSize={12.5}>Plan key</Typography><Typography fontSize={11.5} fontWeight={750} color="text.secondary" sx={{ wordBreak: 'break-all', textAlign: 'right' }}>{row.key || 'Generated on save'}</Typography></Stack>
          </Stack>
        </Paper>
      </Box>
      {(canEdit || canDelete) && <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="flex-end" spacing={1} sx={{ mt: 2 }}>
        {canDelete && <Button variant="outlined" startIcon={<DeleteOutlineRounded />} color="error" onClick={onRemove}>Delete plan</Button>}
        {canEdit && <Button variant="contained" startIcon={<EditRounded />} onClick={onEdit}>Edit and update plan</Button>}
      </Stack>}
    </AccordionDetails>
  </Accordion>;
}


type PropertyDetailItem = { label: string; path?: string; value?: any; type?: Column['type']; full?: boolean };

function isFilled(value: any) {
  if (value === null || value === undefined || value === '') return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

function detailValue(property: any, item: PropertyDetailItem) {
  const value = item.path ? getValue(property, item.path) : item.value;
  if (Array.isArray(value)) return value.length ? value.map((entry) => typeof entry === 'object' ? optionLabel(entry) : optionText(entry)).join(', ') : '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return formatCell(value, item.type);
}

function PropertyDetailSection({ title, subtitle, property, items, defaultExpanded = false }: { title: string; subtitle?: string; property: any; items: PropertyDetailItem[]; defaultExpanded?: boolean }) {
  const visible = items.filter((item) => isFilled(item.path ? getValue(property, item.path) : item.value));
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down('md'));
  const [expanded, setExpanded] = useState(defaultExpanded || !mobile);
  useEffect(() => { setExpanded(defaultExpanded || !mobile); }, [defaultExpanded, mobile]);
  if (!visible.length) return null;
  const fields = <Box sx={{ mt: { xs: 1.2, md: 1.8 }, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' }, gap: { xs: .8, sm: 1, lg: 1.2 } }}>
    {visible.map((item) => <PropertyDataBlock key={`${title}-${item.label}-${item.path || 'value'}`} label={item.label} value={detailValue(property, item)} full={item.full} />)}
  </Box>;
  const header = <PropertySectionHeader title={title} description={subtitle} count={visible.length} />;
  if (!mobile) return <Box data-secureasset-property-detail-section="desktop-grid-v154" sx={{ py: 3, borderTop: '1px solid #DDE4E8' }}>{header}{fields}</Box>;
  return <Accordion
    data-secureasset-property-detail-section="mobile-accordion-v154"
    expanded={expanded}
    onChange={(_event, next) => setExpanded(next)}
    disableGutters
    elevation={0}
    sx={{ mt: 1.1, overflow: 'hidden', border: '1px solid', borderColor: 'rgba(11,82,112,.16)', borderRadius: '14px !important', bgcolor: '#F8FCFD', '&::before': { display: 'none' }, '&.Mui-expanded': { m: 0, mt: 1.1 } }}
  >
    <AccordionSummary expandIcon={<ExpandMoreRounded sx={{ color: '#0B5270' }} />} sx={{ px: 1.35, py: .45, '& .MuiAccordionSummary-content': { my: 1.1, mr: .5 }, '& .MuiAccordionSummary-content.Mui-expanded': { my: 1.1 } }}>
      {header}
    </AccordionSummary>
    <AccordionDetails sx={{ px: 1.1, pt: 0, pb: 1.1, bgcolor: '#FFFFFF' }}>{fields}</AccordionDetails>
  </Accordion>;
}

type PropertyMediaRecord = { _id?: unknown; url?: unknown; thumbnailUrl?: unknown; caption?: unknown; category?: unknown; [key: string]: any };
type PreviewImage = { src: string; previewSrc: string; label: string; filename?: string; recordId?: string; mediaId?: string; previewFileId?: string; secureSource?: string; propertyId?: string; fallbackSources?: string[]; sourceIndex?: number };

function mediaSourceValues(value: unknown): string[] {
  const entries = Array.isArray(value) ? value : [value];
  return entries.flatMap((entry) => {
    const candidate = entry && typeof entry === 'object'
      ? (entry as PropertyMediaRecord).url || (entry as PropertyMediaRecord).thumbnailUrl
      : entry;
    const raw = String(candidate || '').trim();
    if (!raw) return [];
    return raw
      .split(/,\s*(?=(?:https?:\/\/|\/(?:api|uploads)|data:|blob:))/i)
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => /^(?:https?:\/\/|data:|blob:)/i.test(item) || item.startsWith('/') ? item : '/' + item);
  });
}

function isSecureMediaSource(source: string) {
  const value = String(source || '').trim();
  const bare = value.replace(/^\/+/, '').split(/[?#]/, 1)[0];
  return /^[a-f\d]{24}$/i.test(bare) || /\/(?:api\/v\d+\/)?(?:drive\/files|files|property-media)\/[a-f\d]{24}(?:\/content)?(?:[/?#]|$)/i.test(value);
}

function uniqueMediaSources(values: unknown[]) {
  return [...new Set(values.flatMap((value) => mediaSourceValues(value)).filter(Boolean))];
}

function directBrowserImageSource(source: string) {
  const value = String(source || '').trim();
  return Boolean(value) && !isSecureMediaSource(value) && /^(?:https?:\/\/|data:|blob:|\/)/i.test(value);
}

function propertyMediaIdFromSource(source: string) {
  return String(source || '').match(/\/(?:api\/v\d+\/)?property-media\/([a-f\d]{24})(?:\/content)?(?:[/?#]|$)/i)?.[1] || '';
}

function applicationPropertyImage(property: any) {
  const propertyId = String(property?._id || property?.id || '');
  const entries = [property?.propertyMedia, property?.media, property?.galleryCover, property?.coverImage, property?.mainImage, property?.primaryImage, property?.images]
    .flatMap((entry) => Array.isArray(entry) ? entry : entry ? [entry] : []);
  const mediaIds: string[] = [];
  const previewFileIds: string[] = [];
  const secureSources: string[] = [];
  const directSources: string[] = [];

  entries.forEach((entry) => {
    if (entry && typeof entry === 'object') {
      const mediaId = String(entry.mediaId || entry.propertyMediaId || entry.media?._id || '');
      const previewFileId = String(entry.previewFileId || entry.driveFileId || entry.fileId || entry.driveFile?._id || '');
      if (mediaId) mediaIds.push(mediaId);
      if (previewFileId) previewFileIds.push(previewFileId);
    }
    mediaSourceValues(entry && typeof entry === 'object'
      ? [entry.url, entry.thumbnailUrl, entry.previewUrl, entry.secureSource, entry.path]
      : entry).forEach((source) => {
      if (isSecureMediaSource(source)) secureSources.push(source);
      else if (directBrowserImageSource(source)) directSources.push(source);
    });
  });

  const secureMediaIds = secureSources.map((source) => propertyMediaIdFromSource(source) || (/^[a-f\d]{24}$/i.test(source.replace(/^\/+/, '').split(/[?#]/, 1)[0]) ? source.replace(/^\/+/, '').split(/[?#]/, 1)[0] : '')).filter(Boolean);
  return {
    propertyId,
    mediaIds: [...new Set([...mediaIds, ...secureMediaIds])],
    previewFileIds: [...new Set(previewFileIds)],
    secureSources: [...new Set(secureSources.filter((source) => !propertyMediaIdFromSource(source) && !/^[a-f\d]{24}$/i.test(source.replace(/^\/+/, '').split(/[?#]/, 1)[0])))],
    directSources: [...new Set(directSources)],
  };
}

function ApplicationPropertyThumbnail({ property }: { property: any }) {
  const image = useMemo(() => applicationPropertyImage(property), [property]);
  const [src, setSrc] = useState('');

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    setSrc('');
    async function resolveImage() {
      const loaders: Array<() => Promise<Blob>> = [
        ...image.mediaIds.map((mediaId) => () => fetchPropertyMediaBlob(mediaId, image.propertyId)),
        ...image.previewFileIds.map((fileId) => () => fetchPropertyImageBlob(`${API_BASE}/drive/files/${encodeURIComponent(fileId)}/content`, image.propertyId)),
        ...image.secureSources.map((source) => () => fetchPropertyImageBlob(source, image.propertyId)),
      ];
      for (const load of loaders) {
        try {
          const blob = await load();
          if (!active) return;
          objectUrl = URL.createObjectURL(blob);
          setSrc(objectUrl);
          return;
        } catch {
          // Try the next stored source; the list row remains usable while images resolve.
        }
      }
      if (active) setSrc(image.directSources[0] || '');
    }
    void resolveImage();
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [image]);

  return <Box sx={{ gridArea: 'image', width: { xs: 52, md: 58 }, height: { xs: 46, md: 52 }, overflow: 'hidden', border: '1px solid rgba(11,82,112,.12)', borderRadius: '5px', bgcolor: '#EDF4F5', display: 'grid', placeItems: 'center', color: '#6C8991' }}>
    {src ? <Box component="img" src={src} alt={property?.title ? `${property.title} property` : 'Property'} loading="lazy" decoding="async" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <ImageNotSupportedRounded sx={{ fontSize: 21 }} />}
  </Box>;
}

function PropertyImageCard({ image, onPreview, onEdit, onDelete, variant = 'grid', active = false }: { image: PreviewImage; onPreview: (image: PreviewImage) => void; onEdit?: (recordId: string) => void; onDelete?: (recordId: string, label: string) => void; variant?: 'grid' | 'carousel'; active?: boolean }) {
  const [failed, setFailed] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const fallbackKey = (image.fallbackSources || []).join('|');
  const needsAuthenticatedFetch = Boolean(image.mediaId || image.previewFileId || image.secureSource || (image.fallbackSources || []).some(isSecureMediaSource));
  const [loading, setLoading] = useState(needsAuthenticatedFetch);
  const [resolvedSrc, setResolvedSrc] = useState(needsAuthenticatedFetch ? '' : image.src);
  const carousel = variant === 'carousel';

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    const shouldFetch = Boolean(image.mediaId || image.previewFileId || image.secureSource || (image.fallbackSources || []).some(isSecureMediaSource));
    const sourceCandidates = uniqueMediaSources([image.src, ...(image.fallbackSources || [])]);
    setFailed(false);
    setLoading(shouldFetch);
    setResolvedSrc(shouldFetch ? '' : image.src);
    if (!shouldFetch) return () => {};
    async function loadImage() {
      const loaders: Array<() => Promise<Blob>> = [];
      const attemptedMediaIds = new Set<string>();
      if (image.mediaId) {
        attemptedMediaIds.add(image.mediaId);
        loaders.push(() => fetchPropertyMediaBlob(image.mediaId as string, image.propertyId || ''));
      }
      if (image.previewFileId) {
        loaders.push(() => fetchPropertyImageBlob(`${API_BASE}/drive/files/${encodeURIComponent(image.previewFileId as string)}/content`, image.propertyId || ''));
      }
      if (image.secureSource) {
        const referencedMediaId = propertyMediaIdFromSource(image.secureSource);
        if (referencedMediaId && !attemptedMediaIds.has(referencedMediaId)) {
          attemptedMediaIds.add(referencedMediaId);
          loaders.push(() => fetchPropertyMediaBlob(referencedMediaId, image.propertyId || ''));
        } else if (!referencedMediaId) {
          loaders.push(() => fetchPropertyImageBlob(image.secureSource as string, image.propertyId || ''));
        }
      }
      for (const source of sourceCandidates) {
        const referencedMediaId = propertyMediaIdFromSource(source);
        if (referencedMediaId && !attemptedMediaIds.has(referencedMediaId)) {
          attemptedMediaIds.add(referencedMediaId);
          loaders.push(() => fetchPropertyMediaBlob(referencedMediaId, image.propertyId || ''));
        } else if (isSecureMediaSource(source)) {
          loaders.push(() => fetchPropertyImageBlob(source, image.propertyId || ''));
        }
      }
      let lastError: unknown = null;
      for (const load of loaders) {
        try {
          const blob = await load();
          if (!active) return;
          objectUrl = URL.createObjectURL(blob);
          setResolvedSrc(objectUrl);
          setLoading(false);
          return;
        } catch (error) {
          lastError = error;
        }
      }
      const directFallback = sourceCandidates.find(directBrowserImageSource);
      if (directFallback) {
        if (!active) return;
        setResolvedSrc(directFallback);
        setLoading(false);
        return;
      }
      throw lastError || new Error('No stored image source was available');
    }
    void loadImage().catch(() => {
      if (!active) return;
      setLoading(false);
      setFailed(true);
    });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fallbackKey, image.mediaId, image.previewFileId, image.previewSrc, image.propertyId, image.secureSource, image.src, retryNonce]);

  const previewImage = { ...image, src: resolvedSrc, previewSrc: resolvedSrc };
  return <Box data-secureasset-property-gallery-card={carousel ? (active ? 'active-v155' : 'slide-v155') : undefined} sx={{ position: 'relative', height: carousel ? '100%' : undefined, overflow: 'hidden', border: '1px solid #D9E0E5', borderRadius: carousel ? 3 : 2, bgcolor: 'background.paper', boxShadow: carousel && active ? '0 18px 44px rgba(15,23,42,.22)' : undefined }}>
    {loading
      ? <Box sx={{ width: '100%', height: carousel ? '100%' : undefined, aspectRatio: carousel ? 'auto' : '4 / 3', display: 'grid', placeItems: 'center', bgcolor: '#F4F6F7' }}><CircularProgress size={24} sx={{ color: '#0F172A' }} /></Box>
      : failed
      ? <Box sx={{ width: '100%', height: carousel ? '100%' : undefined, aspectRatio: carousel ? 'auto' : '4 / 3', display: 'grid', placeItems: 'center', bgcolor: 'action.hover', px: 2, textAlign: 'center' }}>
        <Stack spacing={.5} alignItems="center"><Typography color="text.secondary" sx={{ fontSize: 12 }}>Image preview unavailable</Typography><Typography color="text.secondary" sx={{ fontSize: 10.5 }}>The uploaded file is still saved.</Typography><Button size="small" onClick={() => setRetryNonce((value) => value + 1)}>Retry preview</Button></Stack>
      </Box>
      : <ButtonBase
        aria-label={'Preview ' + image.label}
        onClick={() => onPreview(previewImage)}
        sx={{ display: 'block', width: '100%', height: carousel ? '100%' : undefined, position: 'relative', textAlign: 'left', '&:hover .sa-image-preview-overlay': { opacity: 1 } }}
      >
        <Box component="img" src={resolvedSrc} alt={image.label} decoding="async" onError={() => setFailed(true)} sx={{ display: 'block', width: '100%', height: carousel ? '100%' : undefined, aspectRatio: carousel ? 'auto' : '4 / 3', objectFit: 'cover', bgcolor: 'action.hover' }} />
        <Box className="sa-image-preview-overlay" sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', gap: .6, p: carousel ? 1.35 : 1, color: 'white', background: 'linear-gradient(transparent, rgba(0,0,0,.72))', opacity: carousel ? 1 : { xs: 1, sm: 0 }, transition: 'opacity .18s ease' }}>
          <VisibilityRounded fontSize="small" />
          <Box sx={{ minWidth: 0 }}><Typography noWrap sx={{ fontSize: carousel ? 13 : 11.5, fontWeight: 850 }}>{image.label}</Typography><Typography noWrap sx={{ mt: .15, fontSize: 10.5, opacity: .86 }}>Click to preview</Typography></Box>
        </Box>
      </ButtonBase>}
    {carousel && image.recordId && (onEdit || onDelete) && <Stack data-secureasset-property-gallery-overlay-actions="top-corner-v155" direction="row" spacing={.45} sx={{ position: 'absolute', top: 10, right: 10, zIndex: 2 }}>
      {onEdit && <Tooltip title="Edit image"><IconButton aria-label={'Edit ' + image.label} size="small" onClick={(event) => { event.stopPropagation(); onEdit(image.recordId as string); }} sx={{ color: '#10212B', bgcolor: 'rgba(255,255,255,.94)', boxShadow: '0 4px 12px rgba(0,0,0,.18)', '&:hover': { bgcolor: '#FFFFFF' } }}><EditRounded fontSize="small" /></IconButton></Tooltip>}
      {onDelete && <Tooltip title="Delete image"><IconButton aria-label={'Delete ' + image.label} size="small" onClick={(event) => { event.stopPropagation(); onDelete(image.recordId as string, image.label); }} sx={{ color: '#B42318', bgcolor: 'rgba(255,255,255,.94)', boxShadow: '0 4px 12px rgba(0,0,0,.18)', '&:hover': { bgcolor: '#FFFFFF' } }}><DeleteOutlineRounded fontSize="small" /></IconButton></Tooltip>}
    </Stack>}
    {!carousel && <Box sx={{ px: 1.2, py: 1 }}>
      <Typography noWrap sx={{ fontSize: 12, fontWeight: 800 }}>{image.label}</Typography>
      {!failed && !loading && <Typography noWrap color="text.secondary" sx={{ fontSize: 10.5, mt: .2 }}>{image.filename || 'Uploaded image'} · click for full preview</Typography>}
      {image.recordId && (onEdit || onDelete) && <Stack direction="row" spacing={.5} sx={{ mt: .8, '& .MuiButton-root': { flex: { xs: 1, sm: '0 1 auto' } } }}>
        {onEdit && <Button size="small" variant="outlined" onClick={() => onEdit(image.recordId as string)}>Edit</Button>}
        {onDelete && <Button size="small" color="error" onClick={() => onDelete(image.recordId as string, image.label)}>Delete</Button>}
      </Stack>}
    </Box>}
  </Box>;
}

function carouselOffset(index: number, activeIndex: number, length: number) {
  let offset = index - activeIndex;
  if (offset > length / 2) offset -= length;
  if (offset < -length / 2) offset += length;
  return offset;
}

function PropertyGalleryCarousel({ images, onPreview, onEdit, onDelete }: { images: PreviewImage[]; onPreview: (image: PreviewImage) => void; onEdit?: (recordId: string) => void; onDelete?: (recordId: string, label: string) => void }) {
  const [activeIndex, setActiveIndex] = useState(0);
  useEffect(() => setActiveIndex((current) => Math.min(Math.max(current, 0), Math.max(images.length - 1, 0))), [images.length]);
  const move = (direction: number) => setActiveIndex((current) => images.length ? (current + direction + images.length) % images.length : 0);

  return <Box data-secureasset-property-gallery-carousel="attachment-style-v155" sx={{ pt: .5 }}>
    <Box data-secureasset-property-gallery-slides="centered-v155" sx={{ position: 'relative', height: { xs: 248, sm: 320, md: 365 }, overflow: 'hidden', isolation: 'isolate' }}>
      {images.map((image, index) => {
        const offset = carouselOffset(index, activeIndex, images.length);
        const distance = Math.abs(offset);
        if (distance > 2) return null;
        const active = offset === 0;
        return <Box
          key={image.recordId ? `media:${image.recordId}:${image.sourceIndex ?? 0}` : `${image.previewSrc}:${index}`}
          data-secureasset-property-gallery-slide={active ? 'active-v155' : 'adjacent-v155'}
          sx={{ position: 'absolute', top: 0, left: '50%', width: { xs: '84%', sm: '64%', md: '57%' }, height: '100%', transform: `translateX(calc(-50% + ${offset * 76}%)) scale(${active ? 1 : distance === 1 ? .86 : .74})`, transformOrigin: 'center center', opacity: active ? 1 : distance === 1 ? .62 : .26, zIndex: 5 - distance, transition: 'transform .42s cubic-bezier(.22,.8,.26,1), opacity .32s ease', pointerEvents: active || distance === 1 ? 'auto' : 'none' }}
        >
          <PropertyImageCard image={image} onPreview={onPreview} onEdit={onEdit} onDelete={onDelete} variant="carousel" active={active} />
        </Box>;
      })}
    </Box>
    {images.length > 1 && <Stack data-secureasset-property-gallery-controls="slide-v155" direction="row" alignItems="center" justifyContent="center" spacing={1.2} sx={{ mt: 1.4 }}>
      <IconButton aria-label="Previous gallery image" size="small" onClick={() => move(-1)} sx={{ border: '1px solid #B8C8D0', color: '#18313D' }}><ChevronLeftRounded fontSize="small" /></IconButton>
      <Typography aria-live="polite" sx={{ minWidth: 46, color: 'text.secondary', fontSize: 12, textAlign: 'center' }}>{activeIndex + 1} / {images.length}</Typography>
      <IconButton aria-label="Next gallery image" size="small" onClick={() => move(1)} sx={{ border: '1px solid #B8C8D0', color: '#18313D' }}><ChevronRightRounded fontSize="small" /></IconButton>
    </Stack>}
  </Box>;
}

function PropertyMediaPreview({ property, propertyMedia = [], onManage, onAdd, onEdit, onDelete, variant = 'grid' }: { property: any; propertyMedia?: PropertyMediaRecord[]; onManage?: () => void; onAdd?: () => void; onEdit?: (recordId: string) => void; onDelete?: (recordId: string, label: string) => void; variant?: 'grid' | 'carousel' }) {
  const [selectedImage, setSelectedImage] = useState<PreviewImage | null>(null);
  const [previewError, setPreviewError] = useState(false);
  const propertyId = String(property?._id || '');
  const legacyImage = (src: string, label: string): PreviewImage => ({
    src,
    previewSrc: src,
    label,
    propertyId,
    ...(propertyMediaIdFromSource(src) ? { mediaId: propertyMediaIdFromSource(src) } : {}),
    ...(isSecureMediaSource(src) ? { secureSource: src } : {}),
  });
  const coverImages = mediaSourceValues(property?.galleryCover).map((src) => legacyImage(src, 'Cover image'));
  const galleryImages = mediaSourceValues(property?.images).map((src, index) => legacyImage(src, 'Property image ' + (index + 1)));
  const attachedImages = propertyMedia.flatMap((item) => {
    const mediaType = String(item?.mediaType || 'image').trim().toLowerCase();
    const mediaSources = uniqueMediaSources([item?.url, item?.thumbnailUrl]);
    const looksLikeImage = mediaType === 'image' || mediaType === 'photo' || mediaType.startsWith('image/')
      || String(item?.mimeType || '').toLowerCase().startsWith('image/')
      || mediaSources.some((source) => /\.(?:jpe?g|png|gif|webp|bmp|ico)(?:[?#]|$)/i.test(source));
    if (!looksLikeImage) return [];
    const mediaId = String(item?._id || '') || undefined;
    const rawPreviewFileId = item?.previewFileId || (item?.driveFile && typeof item.driveFile === 'object' ? item.driveFile._id : item?.driveFile);
    const previewFileId = String(rawPreviewFileId || '').trim() || undefined;
    const authenticatedPreview = mediaId ? `${API_BASE}/property-management/properties/${encodeURIComponent(propertyId)}/media/${encodeURIComponent(mediaId)}/content` : '';
    const publicPreview = mediaId ? `${API_BASE}/public/property-media/${encodeURIComponent(mediaId)}/content` : '';
    const fullSources = mediaSourceValues(item?.url);
    const thumbnailSources = mediaSourceValues(item?.thumbnailUrl);
    // One PropertyMedia record represents one gallery image. Prefer its full
    // source for the card count, while keeping the thumbnail/source values as
    // fallbacks for older records whose fields were stored inconsistently.
    const displaySources = fullSources.length ? fullSources : thumbnailSources;
    const fallbackSources = uniqueMediaSources([displaySources, thumbnailSources]);
    const previewCount = Math.max(displaySources.length, mediaId ? 1 : 0);
    if (!previewCount) return [];
    return Array.from({ length: previewCount }, (_unused, sourceIndex) => {
      const rawSource = displaySources[sourceIndex] || thumbnailSources[sourceIndex] || '';
      return {
      src: fallbackSources.find(directBrowserImageSource) || authenticatedPreview || publicPreview || rawSource,
      previewSrc: authenticatedPreview || publicPreview || rawSource,
      mediaId,
      previewFileId,
      recordId: mediaId,
      propertyId,
      fallbackSources,
      sourceIndex,
      label: String(item?.caption || item?.category || 'Uploaded property image') + (displaySources.length > 1 ? ' ' + (sourceIndex + 1) : ''),
      filename: String(item?.previewFileName || item?.altText || '').trim() || undefined,
      };
    });
  });
  // Keep legacy Property.images/galleryCover entries visible while preferring
  // the PropertyMedia record when both point to the same media item. This is
  // important for older properties whose gallery references were written
  // before PropertyMedia became the canonical collection.
  const imageMap = new Map<string, PreviewImage>();
  for (const image of [...coverImages, ...galleryImages, ...attachedImages]) {
    const key = image.mediaId ? `media:${image.mediaId}:${image.sourceIndex ?? 0}` : `source:${image.previewSrc}`;
    const existing = imageMap.get(key);
    if (!existing || image.recordId) imageMap.set(key, image);
  }
  const images = [...imageMap.values()];
  const [zoomed, setZoomed] = useState(false);
  const closePreview = () => { setSelectedImage(null); setPreviewError(false); setZoomed(false); };
  const openPreview = (image: PreviewImage) => { setPreviewError(false); setZoomed(false); setSelectedImage(image); };
  if (!images.length && !onManage && !onAdd) return null;
  return <>
    <Box data-secureasset-gallery-preview="secureasset-gallery-preview-v65" sx={{ py: { xs: 2.5, md: 3 }, borderTop: '1px solid #DDE4E8' }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={1}>
        <Box>
          <Typography sx={{ fontWeight: 950, fontSize: 18, letterSpacing: '-.02em' }}>Property Galleries · Media Preview</Typography>
          <Typography color="text.secondary" sx={{ fontSize: 12.5, mt: .35 }}>Every uploaded property image is loaded securely. Click any image to enlarge it.</Typography>
        </Box>
        <Stack direction="row" spacing={.7} flexWrap="wrap" useFlexGap>
          <Chip size="small" label={images.length + ' image' + (images.length === 1 ? '' : 's')} variant="outlined" />
          {onManage && <Button size="small" variant="outlined" onClick={onManage}>Manage gallery</Button>}
          {onAdd && <Button size="small" variant="contained" startIcon={<AddRounded />} onClick={onAdd}>Add gallery media</Button>}
        </Stack>
      </Stack>
      <Divider sx={{ my: 2, borderColor: '#E4EAED' }} />
      {images.length ? variant === 'carousel'
        ? <PropertyGalleryCarousel images={images} onPreview={openPreview} onEdit={onEdit} onDelete={onDelete} />
        : <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(3, 1fr)' }, gap: 1.2 }}>
          {images.map((image, index) => <PropertyImageCard key={image.recordId ? `media:${image.recordId}:${image.sourceIndex ?? 0}` : `${image.previewSrc}:${index}`} image={image} onPreview={openPreview} onEdit={onEdit} onDelete={onDelete} />)}
        </Box>
      : <Box sx={{ py: 5, textAlign: 'center', border: '1px dashed', borderColor: 'divider', borderRadius: 3 }}>
        <Typography sx={{ fontWeight: 850 }}>No gallery media attached yet</Typography>
        <Typography color="text.secondary" sx={{ fontSize: 13, mt: .5 }}>Use Add gallery media above to upload the first image for this property.</Typography>
      </Box>}
    </Box>
    <ProfessionalDialog
      open={Boolean(selectedImage)}
      onClose={closePreview}
      fullWidth
      maxWidth="lg"
      fullScreen
      professionalTitle={selectedImage?.label || 'Property image preview'}
      professionalSubtitle="Full-size property media preview"
      enableMinimize={false}
      enableMaximize={false}
    >
      <DialogContent dividers sx={{ minHeight: { xs: 'calc(100dvh - 58px)', sm: 620 }, display: 'flex', flexDirection: 'column', bgcolor: '#101418', p: { xs: 1, sm: 2 }, overflow: 'hidden' }}>
        {selectedImage && !previewError
          ? <>
            <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1} sx={{ color: 'white', pb: 1 }}>
              <Typography sx={{ fontSize: 12, opacity: .78 }}>Click the image to zoom · {zoomed ? 'zoomed view' : 'fit view'}</Typography>
              <Stack direction="row" spacing={.35}>
                <Tooltip title="Zoom out"><span><IconButton size="small" disabled={!zoomed} onClick={() => setZoomed(false)} sx={{ color: 'white' }}><ZoomOutRounded fontSize="small" /></IconButton></span></Tooltip>
                <Tooltip title="Reset zoom"><span><IconButton size="small" disabled={!zoomed} onClick={() => setZoomed(false)} sx={{ color: 'white' }}><RestartAltRounded fontSize="small" /></IconButton></span></Tooltip>
                <Tooltip title="Zoom in"><span><IconButton size="small" onClick={() => setZoomed(true)} sx={{ color: 'white' }}><ZoomInRounded fontSize="small" /></IconButton></span></Tooltip>
              </Stack>
            </Stack>
            <Box sx={{ flex: 1, minHeight: 0, width: '100%', overflow: 'auto', display: 'grid', placeItems: 'center', position: 'relative', bgcolor: '#0B0F12', borderRadius: 2 }}>
              <ButtonBase
                aria-label={zoomed ? 'Zoom out image' : 'Zoom in image'}
                onClick={() => setZoomed((value) => !value)}
                sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: zoomed ? '200%' : '100%', minHeight: '100%', cursor: zoomed ? 'zoom-out' : 'zoom-in' }}
              >
                <Box component="img" src={selectedImage.previewSrc} alt={selectedImage.label} onError={() => setPreviewError(true)} sx={{ display: 'block', width: zoomed ? '100%' : 'auto', maxWidth: zoomed ? 'none' : '100%', maxHeight: zoomed ? 'none' : 'calc(100dvh - 150px)', objectFit: 'contain' }} />
              </ButtonBase>
              {selectedImage.recordId && (onEdit || onDelete) && <Stack data-secureasset-property-gallery-preview-actions="top-corner-v155" direction="row" spacing={.45} sx={{ position: 'absolute', top: 10, right: 10, zIndex: 2 }}>
                {onEdit && <Tooltip title="Edit image"><IconButton aria-label={'Edit ' + selectedImage.label} size="small" onClick={(event) => { event.stopPropagation(); closePreview(); onEdit(selectedImage.recordId as string); }} sx={{ color: '#10212B', bgcolor: 'rgba(255,255,255,.94)', boxShadow: '0 4px 12px rgba(0,0,0,.28)', '&:hover': { bgcolor: '#FFFFFF' } }}><EditRounded fontSize="small" /></IconButton></Tooltip>}
                {onDelete && <Tooltip title="Delete image"><IconButton aria-label={'Delete ' + selectedImage.label} size="small" onClick={(event) => { event.stopPropagation(); closePreview(); onDelete(selectedImage.recordId as string, selectedImage.label); }} sx={{ color: '#B42318', bgcolor: 'rgba(255,255,255,.94)', boxShadow: '0 4px 12px rgba(0,0,0,.28)', '&:hover': { bgcolor: '#FFFFFF' } }}><DeleteOutlineRounded fontSize="small" /></IconButton></Tooltip>}
              </Stack>}
            </Box>
          </>
          : <Alert severity="warning">This image preview is unavailable. The original media record is still preserved.</Alert>}
      </DialogContent>
    </ProfessionalDialog>
  </>;
}

export function PropertyFullDetailsView({ property, propertyMedia = [], onManageGallery, onAddGallery, onEditGallery, onDeleteGallery, showContextBanner = true, galleryVariant = 'grid' }: { property: any; propertyMedia?: PropertyMediaRecord[]; onManageGallery?: () => void; onAddGallery?: () => void; onEditGallery?: (recordId: string) => void; onDeleteGallery?: (recordId: string, label: string) => void; showContextBanner?: boolean; galleryVariant?: 'grid' | 'carousel' }) {
  const listingType = property?.purpose || property?.listingType;
  const priceLabel = listingType === 'sale' ? 'Sale Price' : listingType === 'lease' ? 'Lease Amount' : 'Monthly Rent';
  const pricePath = listingType === 'sale' ? 'pricing.salePrice' : listingType === 'lease' ? 'pricing.leaseAmount' : 'pricing.monthlyRent';
  const contextLocation = [property?.address?.city, property?.address?.state].filter(Boolean).join(', ');
  const contextPrice = detailValue(property, { label: priceLabel, path: pricePath, type: 'money' });
  const propertyDetails: PropertyDetailItem[] = [
    { label: 'Property Title', path: 'title' }, { label: 'Reference Number', path: 'referenceNumber' }, { label: 'Property Code', path: 'code' },
    { label: 'Property Type', path: 'type' }, { label: 'Listing Type', value: listingType, type: 'status' }, { label: 'Property Status', path: 'status', type: 'status' },
    { label: 'Visibility', path: 'visibility', type: 'status' }, { label: 'Publication Status', path: 'publicationStatus', type: 'status' },
    { label: priceLabel, path: pricePath, type: 'money' }, { label: 'Display Price', path: 'price', type: 'money' }, { label: 'Security Deposit', path: 'pricing.securityDeposit', type: 'money' },
    { label: 'Maintenance Charges', path: 'pricing.maintenanceCharge', type: 'money' }, { label: 'Price per sq. feet', path: 'pricing.pricePerUnitArea', type: 'money' }, { label: 'Tax', path: 'pricing.tax', type: 'money' },
    { label: 'Country', path: 'address.country' }, { label: 'State / Province', path: 'address.state' }, { label: 'City', path: 'address.city' }, { label: 'Locality', path: 'address.locality' },
    { label: 'Landmark', path: 'address.landmark' }, { label: 'PIN Code', path: 'address.postalCode' }, { label: 'Full Address', path: 'address.line1', full: true },
    { label: 'Google Map Location', path: 'map.googleMapsLocation', full: true }, { label: 'Latitude', path: 'map.latitude' }, { label: 'Longitude', path: 'map.longitude' },
    { label: 'Bedrooms', path: 'specifications.bedrooms' }, { label: 'Bathrooms', path: 'specifications.bathrooms' }, { label: 'Balconies', path: 'specifications.balconies' },
    { label: 'Floor Number', path: 'specifications.floorNumber' }, { label: 'Kitchen Attached', path: 'specifications.kitchenAttached', type: 'boolean' }, { label: 'Area in sq. feet', path: 'specifications.builtUpAreaSqft' },
    { label: 'Built-up Area', path: 'areas.builtUp' }, { label: 'Carpet Area', path: 'areas.carpet' }, { label: 'Property Age', path: 'specifications.propertyAge' },
    { label: 'Furnishing Status', path: 'specifications.furnishingStatus', type: 'status' }, { label: 'Ownership Type', path: 'specifications.ownershipType', type: 'status' }, { label: 'Available From', path: 'specifications.availableFrom', type: 'date' },
    { label: 'Car Parking Spaces', path: 'parking.carSpaces' }, { label: 'Two Wheeler Parking Spaces', path: 'parking.twoWheelerSpaces' }, { label: 'Visitor Parking', path: 'parking.visitorParking', type: 'boolean' },
    { label: 'Property Description', path: 'description', full: true },
    { label: 'Featured promotion', path: 'promotion.featured', type: 'boolean' }, { label: 'Top listing promotion', path: 'promotion.topListing', type: 'boolean' },
    { label: 'Urgency promotion', path: 'promotion.urgentType', type: 'status' }, { label: 'Promotion starts', path: 'promotion.startsAt', type: 'date' }, { label: 'Promotion ends', path: 'promotion.endsAt', type: 'date' },
  ];
  const utilitiesAmenities: PropertyDetailItem[] = [
    { label: 'Amenities', path: 'amenities', full: true }, { label: 'Water Supply', path: 'utilities.waterSupply' }, { label: 'Electricity Connection', path: 'utilities.electricityConnection' },
    { label: 'Power Backup', path: 'utilities.powerBackup' }, { label: 'Internet Availability', path: 'utilities.internetAvailability', type: 'boolean' }, { label: 'Gas Connection', path: 'utilities.gasConnection', type: 'boolean' },
    { label: 'Sewage Connection', path: 'utilities.sewageConnection', type: 'boolean' }, { label: 'Lift', path: 'amenityDetails.lift', type: 'boolean' }, { label: 'Security', path: 'amenityDetails.security', type: 'boolean' },
    { label: 'CCTV', path: 'amenityDetails.cctv', type: 'boolean' }, { label: 'Gated Community', path: 'amenityDetails.gatedCommunity', type: 'boolean' }, { label: 'Garden', path: 'amenityDetails.garden', type: 'boolean' },
    { label: 'Swimming Pool', path: 'amenityDetails.swimmingPool', type: 'boolean' }, { label: 'Gym', path: 'amenityDetails.gym', type: 'boolean' }, { label: 'Clubhouse', path: 'amenityDetails.clubhouse', type: 'boolean' },
    { label: "Children's Play Area", path: 'amenityDetails.childrenPlayArea', type: 'boolean' }, { label: 'Jogging Track', path: 'amenityDetails.joggingTrack', type: 'boolean' }, { label: 'Community Hall', path: 'amenityDetails.communityHall', type: 'boolean' },
    { label: 'Terrace', path: 'amenityDetails.terrace', type: 'boolean' }, { label: 'Balcony', path: 'amenityDetails.balcony', type: 'boolean' }, { label: 'Air Conditioning', path: 'amenityDetails.airConditioning', type: 'boolean' },
    { label: 'Modular Kitchen', path: 'amenityDetails.modularKitchen', type: 'boolean' }, { label: 'Store Room', path: 'amenityDetails.storeRoom', type: 'boolean' }, { label: 'Servant Room', path: 'amenityDetails.servantRoom', type: 'boolean' },
    { label: 'Wheelchair Access', path: 'amenityDetails.wheelchairAccess', type: 'boolean' }, { label: 'School', path: 'nearbyFacilities.school' }, { label: 'Hospital', path: 'nearbyFacilities.hospital' },
    { label: 'Market', path: 'nearbyFacilities.market' }, { label: 'Bus Stop', path: 'nearbyFacilities.busStop' }, { label: 'Railway Station', path: 'nearbyFacilities.railwayStation' },
    { label: 'Airport', path: 'nearbyFacilities.airport' }, { label: 'Shopping Mall', path: 'nearbyFacilities.shoppingMall' }, { label: 'Park', path: 'nearbyFacilities.park' },
    { label: 'Bank', path: 'nearbyFacilities.bank' }, { label: 'Pharmacy', path: 'nearbyFacilities.pharmacy' },
  ];
  const legalDetails: PropertyDetailItem[] = [
    { label: 'RERA Number', path: 'legalDetails.reraNumber' }, { label: 'Title Clear', path: 'legalDetails.titleClear', type: 'boolean' }, { label: 'Loan Approved', path: 'legalDetails.loanApproved', type: 'boolean' },
    { label: 'Occupancy Certificate', path: 'legalDetails.occupancyCertificate', type: 'boolean' }, { label: 'Completion Certificate', path: 'legalDetails.completionCertificate', type: 'boolean' },
    { label: 'Verified Property', path: 'isVerified', type: 'boolean' }, { label: 'Location Privacy', path: 'locationPrivacy', type: 'status' }, { label: 'Documents', path: 'documents', full: true },
    { label: 'Created By', path: 'createdBy', type: 'user' }, { label: 'Updated By', path: 'updatedBy', type: 'user' }, { label: 'Created At', path: 'createdAt', type: 'date' }, { label: 'Updated At', path: 'updatedAt', type: 'date' },
  ];
  const mediaContacts: PropertyDetailItem[] = [
    { label: 'Owner Name', path: 'contactInformation.ownerName' },
    { label: 'Agent Name', path: 'contactInformation.agentName' }, { label: 'Phone Number', path: 'contactInformation.phoneNumber' }, { label: 'Email Address', path: 'contactInformation.emailAddress' },
    { label: 'Preferred Contact Method', path: 'contactInformation.preferredContactMethod', type: 'status' }, { label: 'Owner Account', path: 'owner', type: 'user' }, { label: 'Manager Account', path: 'manager', type: 'user' },
  ];
  return <Stack spacing={0}>
    {showContextBanner && <PropertyContextBanner
      marker="property-details-context-v154"
      title={property?.title || 'Property Details'}
      description={property?.description || 'Complete property information grouped for quick review.'}
      status={property?.status ? optionText(property.status) : undefined}
      visibility={property?.visibility ? optionText(property.visibility) : undefined}
      reference={property?.referenceNumber ? `Ref ${property.referenceNumber}` : undefined}
      location={contextLocation || undefined}
      insights={[
        { label: priceLabel, value: contextPrice },
        { label: 'Media', value: `${propertyMedia.length} item${propertyMedia.length === 1 ? '' : 's'}` },
      ]}
    />}
    <PropertyDetailSection title="Property Details" subtitle="Basic information, location, specifications, parking and pricing." property={property} items={propertyDetails} defaultExpanded />
    <PropertyDetailSection title="Utilities & Amenities" subtitle="Services, amenities and nearby facilities attached to this property." property={property} items={utilitiesAmenities} />
    <PropertyDetailSection title="Legal Details" subtitle="Verification, legal approvals, certificates and documents." property={property} items={legalDetails} />
    <PropertyDetailSection title="Media & Contacts" subtitle="Gallery, cover image and contact information." property={property} items={mediaContacts} />
    <PropertyMediaPreview property={property} propertyMedia={propertyMedia} onManage={onManageGallery} onAdd={onAddGallery} onEdit={onEditGallery} onDelete={onDeleteGallery} variant={galleryVariant} />
  </Stack>;
}

export default function ResourcePage({ resourceOverride, tenantApplicationView = false }: { resourceOverride?: string; tenantApplicationView?: boolean } = {}) {
  const { module: routeModule = '' } = useParams();
  const module = resourceOverride || routeModule;
  const isMyListings = resourceOverride === 'properties' && routeModule === 'my-listings';
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryHandled = useRef(false);
  const config = configs[module];
  const { user } = useAuth();
  const isTenantApplications = module === 'applications' && user?.role === 'tenant' && tenantApplicationView;
  const isApplicationsWorkspace = module === 'applications' && !isTenantApplications;
  const { data: siteData } = useSite();
  const realtime = useRealtime();
  const actions = useActionDialog();
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down('md'));
  const [rows, setRows] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0, limit: 20 });
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [listingPurpose, setListingPurpose] = useState('');
  const [listingVisibility, setListingVisibility] = useState('');
  const [listingVerification, setListingVerification] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [dialog, setDialog] = useState<{ mode: 'create' | 'edit' | 'view'; row?: any } | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [file, setFile] = useState<File | null>(null);
  const [imageFiles, setImageFiles] = useState<Record<string, File | null>>({});
  const [options, setOptions] = useState<Record<string, any[]>>({});
  const [actionAnchor, setActionAnchor] = useState<null | HTMLElement>(null);
  const [exportMenuAnchor, setExportMenuAnchor] = useState<null | HTMLElement>(null);
  const [actionRow, setActionRow] = useState<any>(null);
  const [rentPaymentDialog, setRentPaymentDialog] = useState<any>(null);
  const [rentPaymentForm, setRentPaymentForm] = useState({ method: 'upi', transactionId: '', proofUrl: '', notes: '' });
  const [rentPaymentBusy, setRentPaymentBusy] = useState(false);
  const [resourcePermissions, setResourcePermissions] = useState<Record<string, string[]> | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAppConfiguration().then((response) => { if (!cancelled) setResourcePermissions(response.data.resourcePermissions || {}); }).catch(() => { if (!cancelled) setResourcePermissions(null); });
    return () => { cancelled = true; };
  }, [user?._id, user?.role, user?.activeMode, user?.landlordEnabled, user?.surveyorEnabled]);

  const propertyFieldsFor = (typeValue?: string): Field[] => {
    if (module !== 'properties' || !typeValue) return [];
    const selected = (siteData.propertyTypes || []).find((item: any) => item.key === typeValue && item.active !== false);
    return [...(selected?.fields || [])].sort((a: any, b: any) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0)).map((item: any) => ({
      name: `customAttributes.${item.key}`, label: item.label || item.key, required: Boolean(item.required),
      type: ['number', 'textarea', 'select', 'boolean', 'array', 'date'].includes(item.type) ? item.type : 'text', options: item.options || [],
    })) as Field[];
  };
  const activeFields = useMemo(() => config ? [...config.fields, ...propertyFieldsFor(form.type)] : [], [config, module, form.type, siteData.propertyTypes]);

  function listRows(params: Record<string, string | number | undefined>) {
    if (isMyListings) return getMyListings(params);
    if (isTenantApplications) return getMyTenantApplications(params);
    return getResource(module, params);
  }

  async function load(page = pagination.page, filters: { search?: string; status?: string; property?: string; listingPurpose?: string; visibility?: string; verification?: string } = {}) {
    if (!config) return;
    setLoading(true); setError('');
    const requestSearch = filters.search ?? search;
    const requestStatus = filters.status ?? status;
    const requestProperty = filters.property ?? (searchParams.get('property') || '');
    const requestListingPurpose = filters.listingPurpose ?? listingPurpose;
    const requestVisibility = filters.visibility ?? listingVisibility;
    const requestVerification = filters.verification ?? listingVerification;
    try {
      const params = {
        page,
        limit: 20,
        search: requestSearch,
        status: requestStatus,
        property: requestProperty,
        ...(isMyListings ? {
          listingPurpose: requestListingPurpose,
          visibility: requestVisibility,
          verification: requestVerification,
        } : {}),
      };
      const result = await listRows(params);
      setRows(result.data); setPagination(result.pagination);
    }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    const requestedSearch = searchParams.get('search') || '';
    const requestedStatus = searchParams.get('status') || '';
    const requestedProperty = searchParams.get('property') || '';
    const requestedPurpose = isMyListings ? (searchParams.get('purpose') || searchParams.get('listingType') || '') : '';
    const requestedVisibility = isMyListings ? (searchParams.get('visibility') || '') : '';
    const requestedVerification = isMyListings ? (searchParams.get('verification') || '') : '';
    setSearch(requestedSearch);
    setStatus(requestedStatus);
    setListingPurpose(requestedPurpose);
    setListingVisibility(requestedVisibility);
    setListingVerification(requestedVerification);
    setPagination((p) => ({ ...p, page: 1 }));
    if (config) void load(1, {
      search: requestedSearch,
      status: requestedStatus,
      property: requestedProperty,
      listingPurpose: requestedPurpose,
      visibility: requestedVisibility,
      verification: requestedVerification,
    });
  }, [module, searchParams, isMyListings, isTenantApplications]);
  useEffect(() => {
    if (!config || !module) return;
    const unsubscribeRoom = realtime.subscribeResource(module);
    let timer: number | undefined;
    const unsubscribeEvent = realtime.subscribe('resource:changed', (payload: any) => {
      if (payload?.resource !== module) return;
      window.clearTimeout(timer); timer = window.setTimeout(() => void load(pagination.page), 180);
    });
    return () => { unsubscribeRoom(); unsubscribeEvent(); window.clearTimeout(timer); };
  }, [module, config, pagination.page, search, status, listingPurpose, listingVisibility, listingVerification, realtime.status]);

  useEffect(() => {
    const recordId = searchParams.get('record');
    if (!config || !recordId) return;
    const recordMode = searchParams.get('edit') === '1' ? 'edit' : 'view';
    const requestedProperty = searchParams.get('property') || undefined;
    const listRequest = listRows({ limit: 100, property: requestedProperty });
    listRequest.then((result) => {
      const row = result.data.find((item: any) => item._id === recordId);
      if (row) openDialog(recordMode, row);
    }).catch((e) => setError((e as Error).message));
  }, [module, config, searchParams, navigate, isMyListings, isTenantApplications]);

  useEffect(() => {
    if (!config || queryHandled.current || searchParams.get('new') !== '1') return;
    queryHandled.current = true;
    if (module === 'properties') { navigate('/app/add_property', { replace: true }); return; }
    const initial: Record<string, any> = {};
    config.fields.forEach((field) => { if (field.type === 'boolean' || field.type === 'radio') initial[field.name] = false; if (field.name === 'status' && field.options?.length) initial[field.name] = field.options[0]; });
    const queryMappings: Record<string, string[]> = {
      property: ['property'], space: ['space', 'targetSpace'], targetSpace: ['targetSpace'], tenancy: ['tenancy'], application: ['application'], tenant: ['tenant'],
    };
    Object.entries(queryMappings).forEach(([queryKey, fieldNames]) => {
      const value = searchParams.get(queryKey);
      if (!value) return;
      const target = fieldNames.find((name) => config.fields.some((field) => field.name === name));
      if (target) initial[target] = value;
    });
    setForm(initial); setDialog({ mode: 'create' });
  }, [module, config, searchParams, navigate]);

  useEffect(() => {
    if (!config) return;
    const references = [...new Set(config.fields.map((f) => f.reference).filter(Boolean))] as string[];
    Promise.all(references.map(async (resource) => { try { return [resource, (await getResource(resource, { limit: 100 })).data] as const; } catch { return [resource, []] as const; } })).then((entries) => setOptions(Object.fromEntries(entries)));
  }, [module]);

  const effectiveRoles: UserRole[] = user ? [user.role, ...(user.role === 'tenant' && user.landlordEnabled ? ['landlord' as UserRole] : []), ...(user.role === 'tenant' && user.surveyorEnabled ? ['surveyor' as UserRole] : [])] : [];
  const roleAllowed = (list: UserRole[]) => Boolean(user && effectiveRoles.some((role) => list.includes(role)));
  const tenantPropertyCreationAllowed = module !== 'properties' || user?.role !== 'tenant' || Boolean(user.landlordEnabled);
  const tenantFacilityCreationAllowed = module !== 'facilities' || user?.role !== 'tenant' || Boolean(user.landlordEnabled);
  const allowedActions = resourcePermissions?.[module];
  const canCreate = Boolean(roleAllowed(config?.createRoles || []) && (!allowedActions || allowedActions.includes('create')) && tenantPropertyCreationAllowed && tenantFacilityCreationAllowed);
  const canEdit = Boolean(roleAllowed(config?.editRoles || []) && (!allowedActions || allowedActions.includes('edit')));
  const canDelete = Boolean(roleAllowed(config?.deleteRoles || []) && (!allowedActions || allowedActions.includes('delete')));
  const applicationReviewStatuses = ['submitted', 'under_review', 'shortlisted', 'interview_requested', 'interview_scheduled', 'site_visit_scheduled', 'additional_documents_requested', 'documents_pending'];
  const applicationAcceptedStatuses = ['approved', 'agreement_pending', 'deposit_pending', 'completed'];
  const applicationStatusFilters = [
    { value: '', label: 'All' },
    { value: 'draft', label: 'Draft' },
    { value: 'submitted', label: 'Submitted' },
    { value: 'under_review', label: 'Under review' },
    { value: 'shortlisted', label: 'Shortlisted' },
    { value: 'interview_requested', label: 'Interview requested' },
    { value: 'interview_scheduled', label: 'Interview scheduled' },
    { value: 'site_visit_scheduled', label: 'Site visit' },
    { value: 'additional_documents_requested', label: 'Documents requested' },
    { value: 'documents_pending', label: 'Documents pending' },
    { value: 'approved', label: 'Approved' },
    { value: 'agreement_pending', label: 'Agreement pending' },
    { value: 'deposit_pending', label: 'Deposit pending' },
    { value: 'completed', label: 'Completed' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'withdrawn', label: 'Withdrawn' },
  ] as const;

  function isApplicationLandlordSide(row: any) {
    if (module !== 'applications' || !user) return false;
    const privileged = ['admin', 'manager'].includes(String(user.role || '').toLowerCase());
    const owner = idOf(row?.property?.owner) === idOf(user) || idOf(row?.landlord) === idOf(user);
    return privileged || (effectiveRoles.includes('landlord') && owner);
  }

  function canDecideApplication(row: any) {
    return Boolean(row && canEdit && isApplicationLandlordSide(row) && applicationReviewStatuses.includes(String(row.status || '').toLowerCase()));
  }

  function applicationStatusOptions(row: any) {
    if (!row || module !== 'applications') return [];
    const current = String(row.status || '').toLowerCase();
    if (isApplicationLandlordSide(row) && applicationReviewStatuses.includes(current)) {
      return applicationReviewStatuses.filter((item) => item !== current);
    }
    if (idOf(row.applicant) === idOf(user) && ['draft', 'submitted'].includes(current)) return ['withdrawn'];
    return [];
  }

  function openDialog(mode: 'create' | 'edit' | 'view', row?: any) {
    const initial: Record<string, any> = {};
    if (row && config) [...config.fields, ...propertyFieldsFor(row.type)].forEach((field) => { let value = getValue(row, field.name); if (field.type === 'reference') value = idOf(value); if (field.type === 'array' && Array.isArray(value)) value = value.map(idOf).join(', '); if (field.type === 'json' && value) value = JSON.stringify(value, null, 2); if (field.type === 'date' && value) value = new Date(value).toISOString().slice(0, 10); if (field.type === 'datetime' && value) value = toLocalDateTimeInput(value); initial[field.name] = value ?? ((field.type === 'boolean' || field.type === 'radio') ? false : ''); });
    if (mode === 'create' && config) config.fields.forEach((field) => { if (field.type === 'boolean' || field.type === 'radio') initial[field.name] = false; if (field.name === 'status' && field.options?.length) initial[field.name] = field.options[0]; });
    if (module === 'landlord-plans') {
      const monthly = Number(getValue(row, 'prices.monthly') || 0);
      const yearly = Number(getValue(row, 'prices.yearly') || 0);
      const billingCycle = yearly > 0 && monthly === 0 ? 'yearly' : 'monthly';
      initial.billingCycle = mode === 'create' ? 'monthly' : billingCycle;
      initial.price = mode === 'create' ? '' : String(initial.billingCycle === 'yearly' ? yearly : monthly);
    }
    setForm(initial); setFile(null); setImageFiles({}); setDialog({ mode, row });
    if (module === 'property-media' && row) setForm((old) => ({ ...old, file: String(row.url || row.thumbnailUrl || '') }));
  }

  function openRecord(row: any) {
    if (module === 'applications' && row?._id) {
      navigate(`/app/application_details/${encodeURIComponent(row._id)}`);
      return;
    }
    if (module === 'tenancies' && row?._id) {
      navigate(`/app/tenancy_details/${encodeURIComponent(row._id)}`);
      return;
    }
    if (module === 'surveyor-profiles' && row?._id) {
      navigate(`/app/surveyor-profiles/${encodeURIComponent(row._id)}`);
      return;
    }
    if ((module === 'properties' || isMyListings) && row?._id) {
      navigate(`/app/property-details/${row._id}`);
      return;
    }
    openDialog('view', row);
  }

  function recordLabel(row: any) {
    return String(row?.title || row?.name || row?.applicationNumber || row?.code || row?._id || config?.singular || 'record');
  }

  function locationPaths(name: string) {
    if (name === 'country') return { country: 'country', state: 'state', city: 'city' };
    if (name.endsWith('.country')) { const prefix = name.slice(0, -'.country'.length); return { country: name, state: `${prefix}.state`, city: `${prefix}.city` }; }
    return null;
  }
  function isLocationSecondary(name: string) {
    return name === 'state' || name === 'city' || name.endsWith('.state') || name.endsWith('.city');
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); if (!config || !dialog) return;
    try {
      if (module === 'documents' && dialog.mode === 'create') {
        if (!file) throw new Error('Select a file to upload');
        await uploadDocument(file, Object.fromEntries(Object.entries(form).filter(([, v]) => v !== '')) as Record<string, string>);
      } else {
        const payload: Record<string, any> = {};
        for (const field of activeFields) {
          if (module === 'property-media' && field.name === 'file') continue;
          if (module === 'landlord-plans' && (field.name === 'billingCycle' || field.name === 'price')) continue;
          let value = form[field.name];
          if (field.type === 'image' && imageFiles[field.name]) {
            value = (await uploadSiteAsset(imageFiles[field.name] as File)).data.url;
          }
          if (field.name === 'password' && !value) continue;
          if (value === '' || value === undefined) {
            if (field.type === 'image' && dialog.mode === 'edit') setValue(payload, field.name, '');
            continue;
          }
          if (field.type === 'number') value = Number(value);
          if (field.type === 'boolean') value = Boolean(value);
          if (field.type === 'radio') value = value === true || value === 'true';
          if (field.type === 'array') value = String(value).split(',').map((v) => v.trim()).filter(Boolean);
          if (field.type === 'json') {
            try { value = JSON.parse(String(value)); } catch { throw new Error(`${field.label} must contain valid JSON`); }
          }
          if (field.type === 'datetime') {
            const parsed = new Date(String(value));
            if (Number.isNaN(parsed.getTime())) throw new Error(`${field.label} must contain a valid date and time`);
            value = parsed.toISOString();
          }
          setValue(payload, field.name, value);
        }
        if (module === 'property-media') {
          const selectedFile = imageFiles.file as File | undefined;
          if (dialog.mode === 'create' && !selectedFile) throw new Error('Choose an image to upload');
          if (selectedFile) {
            const upload = await uploadDocument(selectedFile, {
              property: String(form.property || ''), type: String(form.category || 'property_image'), category: 'image',
              visibility: form.visibility === 'public' ? 'public' : 'private',
            });
            payload.url = upload.data.url;
            payload.thumbnailUrl = upload.data.url;
            payload.document = upload.data._id;
            payload.driveFile = (upload.data as any).driveFile;
            if (!payload.caption) payload.caption = selectedFile.name;
            if (!payload.altText) payload.altText = selectedFile.name;
          }
        }
        if (module === 'landlord-plans') {
          const billingCycle = form.billingCycle === 'yearly' ? 'yearly' : 'monthly';
          const price = Number(form.price);
          if (!Number.isFinite(price) || price < 0) throw new Error('Price must be a valid non-negative number');
          setValue(payload, `prices.${billingCycle}`, price);
          setValue(payload, `prices.${billingCycle === 'yearly' ? 'monthly' : 'yearly'}`, 0);
          if (dialog.mode === 'create') {
            const generatedKey = String(form.name || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
            if (!generatedKey) throw new Error('Plan name must contain letters or numbers');
            payload.key = generatedKey;
          }
        }
        dialog.mode === 'edit' ? await updateResource(module, dialog.row._id, payload) : await createResource(module, payload);
      }
      setDialog(null); setNotice(`${config.singular} saved successfully`); await load();
    } catch (e) { setError((e as Error).message); }
  }

  async function remove(row: any) {
    if (!await actions.askConfirmation(`Delete this ${config.singular.toLowerCase()}? This cannot be undone.`, { title: `Delete ${config.singular}`, danger: true })) return;
    try { await deleteResource(module, row._id); setNotice(`${config.singular} deleted`); await load(); } catch (e) { setError((e as Error).message); }
  }
  async function changeStatus(next: string) {
    if (!actionRow) return;
    try {
      if (module === 'surveyor-verifications') {
        const notes = await actions.askText('Add an optional reviewer note.', { title: 'Verification review', label: 'Reviewer note' }) || undefined;
        const reason = ['rejected', 'changes_required', 'suspended'].includes(next) ? (await actions.askText('Explain this decision to the Surveyor.', { title: 'Decision reason', label: 'Reason' }) || undefined) : undefined;
        await reviewSurveyorVerification(actionRow._id, { status: next, notes, ...(next === 'suspended' ? { suspensionReason: reason } : { rejectionReason: reason }) });
      } else await changeResourceStatus(module, actionRow._id, next);
      setNotice(`Status changed to ${optionText(next)}`); setActionAnchor(null); await load();
    } catch (e) { setError((e as Error).message); }
  }
  async function decideApplication(row: any, next: 'approved' | 'rejected') {
    if (!canDecideApplication(row)) {
      setError('Accept or reject is available only to the property landlord while the application is under review.');
      return;
    }
    const rejectionReason = next === 'rejected'
      ? await actions.askText('Add the reason that will be shared with the applicant.', { title: 'Rejection reason', label: 'Reason' })
      : '';
    if (next === 'rejected' && !String(rejectionReason || '').trim()) return;
    const confirmed = await actions.askConfirmation(
      next === 'approved'
        ? 'Accept this application? The matching rent, lease or sale agreement workflow will become available.'
        : `Reject this application and share the reason “${String(rejectionReason).trim()}”? Accept and reject will no longer be available for this record.`,
      { title: next === 'approved' ? 'Accept application' : 'Reject application', danger: next === 'rejected' },
    );
    if (!confirmed) return;
    try {
      const result = await decideRentalApplication(row._id, { status: next, ...(next === 'rejected' && { remarks: String(rejectionReason).trim() }) });
      setActionAnchor(null);
      setRows((current) => current.map((item) => item._id === row._id ? { ...item, ...(result.data || {}), status: next } : item));
      setDialog((current) => {
        if (!current || current.row?._id !== row._id) return current;
        return {
          mode: current.mode,
          row: { ...current.row, ...(result.data || {}), status: next },
        };
      });
      setNotice(next === 'approved' ? 'Application accepted. Agreement workflow is now available.' : 'Application rejected.');
      await load();
    } catch (e) { setError((e as Error).message); }
  }
  async function changeVisibility(row: any) {
    const id = String(row?._id || '');
    if (module !== 'properties' || !id) return;
    const next = row.visibility === 'public' ? 'private' : 'public';
    const confirmed = await actions.askConfirmation(
      next === 'public'
        ? 'Make this property public? Tenants will be able to discover it on the marketplace.'
        : 'Make this property private? It will be removed from the public marketplace and kept in your workspace.',
      { title: next === 'public' ? 'Publish property' : 'Make property private', danger: next === 'private' },
    );
    if (!confirmed) return;
    try {
      await updateResource('properties', id, { visibility: next });
      setActionAnchor(null);
      setNotice(`Property is now ${next}.`);
      await load();
    } catch (e) { setError((e as Error).message); }
  }
  async function payInvoice(row: any) {
    if (!await actions.askConfirmation(`Submit payment for ${formatCell(row.amount, 'money')} against invoice ${row.invoiceNumber}?`, { title: 'Submit payment' })) return;
    try { const result = await paySurveyInvoice(row._id, { method: 'gateway' }); setNotice(result.message || 'Survey invoice payment submitted for verification'); setActionAnchor(null); await load(); }
    catch (e) { setError((e as Error).message); }
  }
  function openRentPayment(row: any) {
    setActionAnchor(null);
    setRentPaymentForm({ method: 'upi', transactionId: '', proofUrl: '', notes: '' });
    setRentPaymentDialog(row);
  }
  async function submitRentPayment(event: FormEvent) {
    event.preventDefault();
    if (!rentPaymentDialog?.rentalInvoice) return;
    setRentPaymentBusy(true); setError('');
    try {
      const result = await submitRentalInvoicePayment(String(idOf(rentPaymentDialog.rentalInvoice)), {
        method: rentPaymentForm.method as 'upi' | 'card' | 'bank_transfer' | 'cash' | 'cheque' | 'gateway' | 'offline',
        transactionId: rentPaymentForm.transactionId || undefined,
        proofUrl: rentPaymentForm.proofUrl || undefined,
        notes: rentPaymentForm.notes || undefined,
      });
      setRentPaymentDialog(null); setNotice(result.message || 'Rent payment submitted for landlord approval'); await load();
    } catch (e) { setError((e as Error).message); }
    finally { setRentPaymentBusy(false); }
  }
  async function acceptRentPayment(row: any) {
    if (!await actions.askConfirmation(`Accept ${formatCell(row.amount, 'money')} for ${row.invoiceNumber}? The linked rent invoice will be settled.`, { title: 'Accept rent payment' })) return;
    try { const result = await acceptRentalPayment(row._id); setNotice(result.message || 'Rent payment accepted'); setActionAnchor(null); await load(); }
    catch (e) { setError((e as Error).message); }
  }
  async function rejectRentPayment(row: any) {
    const reason = await actions.askText('Tell the tenant why this payment cannot be accepted. They can correct and resubmit it.', { title: 'Reject rent payment', label: 'Rejection reason' });
    if (reason === null) return;
    if (!reason.trim()) { setError('A rejection reason is required.'); return; }
    try { const result = await rejectRentalPayment(row._id, reason.trim()); setNotice(result.message || 'Rent payment rejected'); setActionAnchor(null); await load(); }
    catch (e) { setError((e as Error).message); }
  }
  async function acceptQuotation(row: any) {
    if (!await actions.askConfirmation(`Accept quotation ${row.quotationNumber || ''} and create a survey project?`, { title: 'Accept quotation' })) return;
    try { await acceptSurveyQuotation(row._id); setNotice('Quotation accepted and survey project created'); setActionAnchor(null); await load(); }
    catch (e) { setError((e as Error).message); }
  }
  async function acceptTenantSubscription(row: any) {
    const tenantName = optionLabel(row.user) || 'this tenant';
    if (!await actions.askConfirmation(`Accept the pending subscription for ${tenantName}? This verifies the linked manual payment, activates the tenant entitlement and exposes the subscribed Landlord features to that account.`, { title: 'Accept tenant subscription' })) return;
    try { const result = await approveTenantSubscription(row._id); setNotice(result.message || 'Tenant subscription accepted and activated'); setActionAnchor(null); await load(); }
    catch (e) { setError((e as Error).message); }
  }
  async function rejectTenantSubscriptionOrder(row: any) {
    const reason = await actions.askText('Tell the tenant why this subscription request is being rejected.', { title: 'Reject subscription', label: 'Rejection reason' });
    if (reason === null) return;
    if (!reason.trim()) { setError('A rejection reason is required.'); return; }
    try { const result = await rejectTenantSubscription(row._id, reason.trim()); setNotice(result.message || 'Subscription rejected'); setActionAnchor(null); await load(); } catch (e) { setError((e as Error).message); }
  }
  async function lockReport(row: any) {
    const digitalSignature = await actions.askText('Enter the signatory name or digital signature reference.', { title: 'Finalize survey report', label: 'Digital signature' }) || undefined;
    if (!await actions.askConfirmation('Finalize and lock this report? Locked reports cannot be edited without an authorised revision.', { title: 'Lock final report' })) return;
    try { await finalizeSurveyReport(row._id, digitalSignature); setNotice('Survey report finalized and locked'); setActionAnchor(null); await load(); }
    catch (e) { setError((e as Error).message); }
  }
  async function exportSurveyReport(row: any, format: 'pdf' | 'xlsx' | 'csv') {
    try { await downloadSurveyReport(row._id, format); setNotice(`Survey report exported as ${format.toUpperCase()}`); setActionAnchor(null); }
    catch (e) { setError((e as Error).message); }
  }

  const columns = useMemo(() => config?.columns || [], [config]);
  if (!config) return <Box sx={{ px: 4, py: 8 }}><Alert severity="info">This module is being configured for your organisation.</Alert></Box>;

  const compactTenantApplicationView = isTenantApplications;
  const compactRequestedResourceView = isMyListings || COMPACT_RESOURCE_MODULES.has(module);
  function exportResource(format: 'csv' | 'xlsx' | 'pdf') {
    setExportMenuAnchor(null);
    void downloadReport(module, format).catch((error) => setError(error.message));
  }
  const listingPageActions = <Stack direction="row" spacing={.8} flexWrap="wrap" useFlexGap>
    <Button size="small" variant="outlined" startIcon={<FileDownloadRounded />} onClick={(event) => setExportMenuAnchor(event.currentTarget)}>Export</Button>
    <Button size="small" variant="outlined" startIcon={<RefreshRounded />} onClick={() => load()}>Refresh</Button>
    {canCreate && <Button size="small" variant="contained" startIcon={<AddRounded />} onClick={() => navigate('/app/add_property')}>Add property</Button>}
  </Stack>;
  const pageActions = <Stack direction="row" spacing={.8} flexWrap="wrap" useFlexGap>
    {module !== 'tenancies' && <>
      <Button size="small" variant="outlined" startIcon={<FileDownloadRounded />} onClick={() => downloadReport(module, 'csv').catch((e) => setError(e.message))}>CSV</Button>
      <Button size="small" variant="outlined" startIcon={<FileDownloadRounded />} onClick={() => downloadReport(module, 'xlsx').catch((e) => setError(e.message))}>Excel</Button>
      <Button size="small" variant="outlined" startIcon={<FileDownloadRounded />} onClick={() => downloadReport(module, 'pdf').catch((e) => setError(e.message))}>PDF</Button>
    </>}
    <Button size="small" variant="outlined" startIcon={<RefreshRounded />} onClick={() => load()}>Refresh</Button>
    {canCreate && module !== 'applications' && <Button size="small" className={module === 'properties' ? undefined : 'sa-submit-button'} variant="contained" startIcon={module === 'documents' ? <UploadFileRounded /> : <AddRounded />} onClick={() => module === 'properties' ? navigate('/app/add_property') : openDialog('create')}>{module === 'documents' ? 'Upload' : module === 'tenancies' ? 'Add tenant' : `Add ${config.singular}`}</Button>}
    {module === 'tenancies' && <Tooltip title="Export records">
      <IconButton
        size="small"
        aria-label="Tenancy export options"
        aria-haspopup="menu"
        aria-expanded={Boolean(exportMenuAnchor)}
        onClick={(event) => setExportMenuAnchor(event.currentTarget)}
        sx={{ width: 36, height: 36, border: '1px solid rgba(11,82,112,.18)', borderRadius: 2, color: '#0B5270', bgcolor: '#fff' }}
      ><MoreVertRounded fontSize="small" /></IconButton>
    </Tooltip>}
  </Stack>;

  return <Box className={isMyListings ? 'sa-my-listings-premium' : isApplicationsWorkspace ? 'sa-applications-premium' : undefined} data-secureasset-applications-filter="applications-filter-v66" data-secureasset-application-list={module === 'applications' ? 'record-frame-v1' : undefined} data-secureasset-tenancy-list={module === 'tenancies' ? 'record-frame-v1' : undefined} data-secureasset-clickable-records="clickable-records-v70" data-secureasset-property-visibility="property-visibility-v71" data-secureasset-application-actions="direct-decision-v76" data-secureasset-surveyor-profile-source={module === 'surveyor-profiles' ? 'live-resource-api-v208' : undefined} data-secureasset-surveyor-profile-navigation={module === 'surveyor-profiles' ? 'admin-detail-v210' : undefined} sx={{ px: { xs: 2, sm: 3, lg: 4 }, pb: 5 }}>
    {isMyListings ? <PageHeader
      variant="plain"
      eyebrow="Property portfolio"
      title="My Listings"
      description="Manage rent, lease and sale properties in one secure workspace. Filter listings by visibility and survey verification."
      meta={<Stack direction="row" gap={.7} flexWrap="wrap" useFlexGap><Chip size="small" label={`${pagination.total} matching ${pagination.total === 1 ? 'property' : 'properties'}`} variant="outlined" /><Chip size="small" color="success" label="Owner-scoped workspace" /></Stack>}
      actions={listingPageActions}
    /> : isApplicationsWorkspace ? <PageHeader
      variant="plain"
      eyebrow="Tenant applications"
      title="Applications"
      description="Review every tenant request in one premium workspace, move quickly between workflow statuses, and open a record for the complete application and agreement journey."
      meta={<Stack direction="row" gap={.7} flexWrap="wrap" useFlexGap><Chip size="small" label={`${pagination.total} matching ${pagination.total === 1 ? 'application' : 'applications'}`} variant="outlined" /><Chip size="small" color="success" label="Live application workflow" /></Stack>}
      actions={pageActions}
    /> : compactTenantApplicationView ? <Stack data-secureasset-my-applications-toolbar="compact-v151" direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} justifyContent="space-between" gap={1.2} sx={{ mb: 2.2 }}>
      <Chip size="small" label={`${pagination.total} ${pagination.total === 1 ? 'application' : 'applications'}`} variant="outlined" sx={{ alignSelf: { xs: 'flex-start', sm: 'center' }, fontWeight: 750 }} />
      {pageActions}
    </Stack> : compactRequestedResourceView ? <CompactPageToolbar
      marker={`resource-${module}-toolbar-v153`}
      title={isMyListings ? 'My Listings' : moduleLabel(module)}
      description={module === 'applications'
        ? `${pagination.total} ${pagination.total === 1 ? 'application' : 'applications'} in this workspace.`
        : `${pagination.total} ${pagination.total === 1 ? 'record' : 'records'} in this workspace.`}
      actions={pageActions}
    /> : <PageHeader
      eyebrow={module === 'properties' ? 'Portfolio' : module === 'payments' || module === 'rental-invoices' ? 'Finance' : module === 'documents' ? 'Secure records' : 'Operations'}
      title={isMyListings ? 'My Listings' : moduleLabel(module)}
      description={`${pagination.total} ${pagination.total === 1 ? 'record' : 'records'} in this workspace. Search, review and act without losing your place.`}
      actions={pageActions}
    />}

    {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}
    {isMyListings ? <Paper className="sa-my-listings-filter-panel sa-surface-card" elevation={0}>
      <Stack className="sa-my-listings-search-row" direction={{ xs: 'column', md: 'row' }} alignItems={{ md: 'center' }} spacing={1.1}>
        <TextField
          className="sa-my-listings-search"
          fullWidth
          size="small"
          placeholder="Search property name, code, city or address…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load(1)}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchRounded fontSize="small" /></InputAdornment> }}
        />
        {config.statuses && <FormControl size="small" className="sa-my-listings-status">
          <InputLabel>Status</InputLabel>
          <Select label="Status" value={status} onChange={(e) => { const next = e.target.value; setStatus(next); void load(1, { status: next }); }}>
            <MenuItem value="">All statuses</MenuItem>
            {config.statuses.map((item) => <MenuItem key={item} value={item}>{optionText(item)}</MenuItem>)}
          </Select>
        </FormControl>}
        <Button variant="contained" onClick={() => load(1)}>Search</Button>
      </Stack>

      <Box className="sa-my-listings-filter-section">
        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1} sx={{ mb: 1 }}>
          <Box><Typography className="sa-my-listings-filter-label">Listing type</Typography><Typography className="sa-my-listings-filter-help">Separate your portfolio by transaction type.</Typography></Box>
        </Stack>
        <Box className="sa-my-listings-purpose-grid">
          {[
            { value: '', label: 'All properties', caption: 'Complete portfolio' },
            { value: 'rent', label: 'Rent properties', caption: 'Rental listings' },
            { value: 'lease', label: 'Lease properties', caption: 'Lease listings' },
            { value: 'sale', label: 'Sale properties', caption: 'Properties for sale' },
          ].map((option, index) => <Button
            key={option.value || 'all'}
            className="sa-my-listings-purpose-button"
            aria-pressed={listingPurpose === option.value}
            onClick={() => { setListingPurpose(option.value); void load(1, { listingPurpose: option.value }); }}
          >
            <Box className={`sa-my-listings-purpose-dot tone-${index}`} />
            <Box sx={{ minWidth: 0, textAlign: 'left' }}><Typography className="sa-my-listings-purpose-title">{option.label}</Typography><Typography className="sa-my-listings-purpose-caption">{option.caption}</Typography></Box>
          </Button>)}
        </Box>
      </Box>

      <Box className="sa-my-listings-filter-section sa-my-listings-secondary-filters">
        <Box>
          <Typography className="sa-my-listings-filter-label">Visibility</Typography>
          <Stack direction="row" gap={.65} flexWrap="wrap" useFlexGap sx={{ mt: .75 }}>
            {[
              { value: '', label: 'All visibility' },
              { value: 'public', label: 'Public' },
              { value: 'private', label: 'Private' },
            ].map((option) => <Button key={option.value || 'all'} className="sa-my-listings-filter-pill" aria-pressed={listingVisibility === option.value} onClick={() => { setListingVisibility(option.value); void load(1, { visibility: option.value }); }}>{option.label}</Button>)}
          </Stack>
        </Box>
        <Box>
          <Typography className="sa-my-listings-filter-label">Survey verification</Typography>
          <Stack direction="row" gap={.65} flexWrap="wrap" useFlexGap sx={{ mt: .75 }}>
            {[
              { value: '', label: 'All verification' },
              { value: 'verified', label: 'Surveyed / Verified' },
              { value: 'unverified', label: 'Unverified' },
            ].map((option) => <Button key={option.value || 'all'} className="sa-my-listings-filter-pill" aria-pressed={listingVerification === option.value} onClick={() => { setListingVerification(option.value); void load(1, { verification: option.value }); }}>{option.label}</Button>)}
          </Stack>
        </Box>
        {(listingPurpose || listingVisibility || listingVerification || status || search) && <Button className="sa-my-listings-clear" variant="text" onClick={() => {
          setSearch(''); setStatus(''); setListingPurpose(''); setListingVisibility(''); setListingVerification('');
          void load(1, { search: '', status: '', listingPurpose: '', visibility: '', verification: '' });
        }}>Clear filters</Button>}
      </Box>
    </Paper> : isApplicationsWorkspace ? <Paper className="sa-applications-filter-panel sa-surface-card" elevation={0}>
      <Stack className="sa-applications-search-row" direction={{ xs: 'column', md: 'row' }} alignItems={{ md: 'center' }} spacing={1}>
        <TextField
          className="sa-applications-search"
          fullWidth
          size="small"
          placeholder="Search by application ID, tenant or property…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && load(1)}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchRounded fontSize="small" /></InputAdornment> }}
        />
        <Button variant="contained" onClick={() => load(1)} sx={{ whiteSpace: 'nowrap' }}>Search</Button>
        {(search || status) && <Button className="sa-applications-clear" variant="text" onClick={() => { setSearch(''); setStatus(''); void load(1, { search: '', status: '' }); }}>Clear</Button>}
      </Stack>
      <Box className="sa-applications-status-section">
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'flex-end' }} gap={.7} className="sa-applications-status-heading">
          <Box>
            <Typography className="sa-applications-filter-label">Application status</Typography>
            <Typography className="sa-applications-filter-help">Select a workflow status to show only matching applications.</Typography>
          </Box>
          <Typography className="sa-applications-filter-count">{pagination.total} result{pagination.total === 1 ? '' : 's'}</Typography>
        </Stack>
        <Box className="sa-applications-status-tabs" role="tablist" aria-label="Filter applications by status">
          {applicationStatusFilters.map((option) => <Button
            key={option.value || 'all'}
            role="tab"
            aria-selected={status === option.value}
            className="sa-applications-status-tab"
            data-status={option.value || 'all'}
            onClick={() => { setStatus(option.value); void load(1, { status: option.value }); }}
          >
            {option.label}
          </Button>)}
        </Box>
      </Box>
    </Paper> : <Paper className={`sa-surface-card${module === 'applications' ? ' sa-applications-filter-frame' : ''}`} elevation={0} sx={{ p: { xs: 1.4, sm: 1.7 }, mb: 2, borderRadius: 4, ...(module === 'applications' ? { borderColor: 'rgba(11,82,112,.16)', background: 'linear-gradient(145deg, #FFFFFF 0%, #F6FBFC 100%)' } : {}) }}><Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} spacing={1.2}><TextField fullWidth size="small" placeholder={`Search ${(isMyListings ? 'my listings' : moduleLabel(module)).toLowerCase()}…`} value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load(1)} InputProps={{ startAdornment: <InputAdornment position="start"><SearchRounded fontSize="small" /></InputAdornment> }} />{config.statuses && <FormControl size="small" sx={{ minWidth: { sm: 185 } }}><InputLabel>Status</InputLabel><Select label="Status" value={status} onChange={(e) => { const next = e.target.value; setStatus(next); void load(1, { status: next }); }}><MenuItem value="">All statuses</MenuItem>{config.statuses.map((item) => <MenuItem key={item} value={item}>{optionText(item)}</MenuItem>)}</Select></FormControl>}<Button variant="contained" onClick={() => load(1)} sx={{ whiteSpace: 'nowrap' }}>Search</Button></Stack></Paper>}

    {loading ? (
      <Box sx={{ py: 12, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>
    ) : rows.length === 0 ? (
      <Paper className="sa-surface-card" elevation={0} sx={{ py: 10, textAlign: 'center', border: '1px dashed', borderColor: 'divider', borderRadius: 4 }}>
        <Typography sx={{ fontWeight: 850 }}>No records found</Typography>
        <Typography color="text.secondary" sx={{ fontSize: 13, mt: .5 }}>Adjust the filters or create the first record.</Typography>
      </Paper>
    ) : module === 'landlord-plans' ? (
      <Stack spacing={1.4}>
        {rows.map((row) => <LandlordPlanResourceAccordion
          key={row._id}
          row={row}
          canEdit={canEdit}
          canDelete={canDelete}
          onEdit={() => openDialog('edit', row)}
          onRemove={() => remove(row)}
        />)}
      </Stack>
    ) : isMyListings ? (
      <Box
        data-secureasset-my-listings-grid="amenity-dashboard-v1"
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' },
          gap: { xs: 1, md: 1.8 },
          alignItems: 'stretch',
        }}
      >
        {rows.map((row) => <PropertyPortfolioCard
          key={row._id}
          row={row}
          onOpen={() => openRecord(row)}
          onEdit={canEdit ? () => openDialog('edit', row) : undefined}
          onManageRooms={() => navigate(`/app/my-listings/${encodeURIComponent(row._id)}/rooms`)}
          onMore={(event) => { setActionAnchor(event.currentTarget); setActionRow(row); }}
        />)}
      </Box>
    ) : module === 'applications' ? (
      <Stack className="sa-applications-record-list" data-secureasset-application-record-list="dashboard-rows-v1" spacing={{ xs: 1, sm: 1.25 }}>
        {rows.map((row) => {
          const applicationNumber = String(row.applicationNumber || row._id || 'Application');
          const normalizedStatus = String(row.status || 'draft').toLowerCase();
          const accepted = applicationAcceptedStatuses.includes(normalizedStatus);
          const tenantName = formatCell(row.applicant, 'user');
          const property = row.property && typeof row.property === 'object' ? row.property : {};
          const propertyName = property.title || property.code || row.targetSpace?.name || row.rentalUnit?.name || formatCell(row.property, 'property');
          const propertyLocation = property.address?.city || property.map?.locality || property.address?.state || '';
          const createdDate = row.createdAt ? new Date(row.createdAt) : null;
          const applicationDate = createdDate && !Number.isNaN(createdDate.getTime())
            ? createdDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
            : '—';
          const applicationDetailsPath = row?._id
            ? `/app/application_details/${encodeURIComponent(row._id)}`
            : undefined;
          const statusTone = ['approved', 'agreement_pending', 'deposit_pending', 'completed'].includes(normalizedStatus)
            ? { color: '#176B4D', background: '#E7F5EE', border: 'rgba(23,107,77,.18)' }
            : ['rejected', 'withdrawn'].includes(normalizedStatus)
              ? { color: '#A43F40', background: '#FCEEEE', border: 'rgba(164,63,64,.18)' }
              : ['under_review', 'documents_pending', 'shortlisted', 'interview_requested', 'interview_scheduled', 'site_visit_scheduled', 'additional_documents_requested'].includes(normalizedStatus)
                ? { color: '#8A5A12', background: '#FFF5E2', border: 'rgba(138,90,18,.2)' }
                : { color: '#0B5270', background: '#E4F3F7', border: 'rgba(11,82,112,.18)' };
          return <Card
            key={row._id}
            className="sa-surface-card sa-applications-record-row"
            elevation={0}
            sx={{
              position: 'relative',
              overflow: 'hidden',
              borderColor: 'rgba(11,82,112,.15)',
              background: 'linear-gradient(145deg, #FFFFFF 0%, #F8FCFD 100%)',
              cursor: applicationDetailsPath ? 'pointer' : 'default',
              transition: 'border-color .18s ease, transform .18s ease, box-shadow .18s ease',
              '&:hover': { borderColor: '#0B5270', transform: 'translateY(-1px)', boxShadow: '0 12px 24px rgba(11,82,112,.09)' },
            }}
          >
            {applicationDetailsPath && <ButtonBase
              component={Link}
              to={applicationDetailsPath}
              className="sa-application-record-link"
              aria-label={`Open application details for ${tenantName}, reference ${applicationNumber}`}
              sx={{
                position: 'absolute',
                inset: 0,
                zIndex: 1,
                borderRadius: 'inherit',
                '&.Mui-focusVisible': { outline: '3px solid #0B5270', outlineOffset: '-4px' },
              }}
            />}
            <CardContent sx={{ p: { xs: 1.2, sm: 1.5, xl: 1.7 }, pointerEvents: 'none', '&:last-child': { pb: { xs: 1.2, sm: 1.5, xl: 1.7 } } }}>
              <Box
                className="sa-application-record-grid"
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '56px minmax(0, 1fr)', md: '56px minmax(88px, 1fr) minmax(108px, 1.2fr) minmax(76px, .75fr) minmax(104px, 1fr) minmax(78px, .75fr)', xl: '72px minmax(130px, 1fr) minmax(180px, 1.35fr) minmax(115px, .85fr) minmax(180px, 1.25fr) minmax(116px, .75fr)' },
                  gridTemplateAreas: { xs: '"image tenant" "property property" "status date" "actions actions"', md: '"image tenant property status actions date"' },
                  alignItems: 'center',
                  columnGap: { xs: 1, md: 1.15, xl: 1.5 },
                  rowGap: { xs: 1, md: .7 },
                  minWidth: 0,
                }}
              >
                <ApplicationPropertyThumbnail property={property} />

                <Box sx={{ gridArea: 'tenant', minWidth: 0 }}>
                  <Typography className="sa-application-record-label" sx={{ color: '#71858A', fontSize: 9, fontWeight: 850, letterSpacing: '.07em', textTransform: 'uppercase' }}>Tenant name</Typography>
                  <Typography className="sa-application-record-title" noWrap title={tenantName} sx={{ mt: .1, fontSize: { xs: 13, md: 12.5, xl: 14 }, fontWeight: 850, lineHeight: 1.25 }}>{tenantName}</Typography>
                  <Typography className="sa-application-record-subtitle" noWrap title={applicationNumber} sx={{ mt: .25, color: '#71858A', fontSize: 10, lineHeight: 1.25 }}>Application ID · {applicationNumber}</Typography>
                </Box>

                <Box sx={{ gridArea: 'property', minWidth: 0 }}>
                  <Typography className="sa-application-record-label" sx={{ color: '#71858A', fontSize: 9, fontWeight: 850, letterSpacing: '.07em', textTransform: 'uppercase' }}>Property</Typography>
                  <Typography className="sa-application-record-value" title={String(propertyName)} sx={{ mt: .1, color: '#183238', fontSize: { xs: 12.5, md: 12, xl: 13.5 }, fontWeight: 800, lineHeight: 1.3, overflowWrap: 'anywhere' }}>{propertyName}</Typography>
                  {propertyLocation && <Typography noWrap sx={{ mt: .15, color: '#75878A', fontSize: 10.5 }}>{propertyLocation}</Typography>}
                </Box>

                <Stack sx={{ gridArea: 'status', minWidth: 0 }} spacing={.3} alignItems={{ xs: 'flex-start', md: 'flex-start' }}>
                  <Typography className="sa-application-record-label" sx={{ color: '#71858A', fontSize: 9, fontWeight: 850, letterSpacing: '.07em', textTransform: 'uppercase' }}>Status</Typography>
                  <Chip size="small" label={optionText(normalizedStatus)} className="sa-application-status-chip" sx={{ maxWidth: '100%', height: 25, color: statusTone.color, bgcolor: statusTone.background, border: `1px solid ${statusTone.border}`, '& .MuiChip-label': { px: .9, overflow: 'hidden', textOverflow: 'ellipsis' } }} />
                  {row.paymentStatus && <Typography noWrap className="sa-application-payment-chip" sx={{ color: '#75878A', fontSize: 9.5 }}>Payment · {formatCell(row.paymentStatus, 'status')}</Typography>}
                </Stack>

                <Stack className="sa-application-record-actions" sx={{ gridArea: 'actions', minWidth: 0, position: 'relative', zIndex: 2, pointerEvents: 'auto' }} direction="row" alignItems="center" flexWrap="wrap" useFlexGap gap={.35} onClick={(event) => event.stopPropagation()}>
                  {canDecideApplication(row) && <>
                    <Button size="small" variant="contained" color="success" startIcon={<CheckCircleRounded />} onClick={() => void decideApplication(row, 'approved')} sx={{ minHeight: 29, minWidth: 0, px: { xs: .85, xl: 1 }, fontSize: 10.5, fontWeight: 850, textTransform: 'none', '& .MuiButton-startIcon': { mr: .4, ml: 0 }, '& .MuiSvgIcon-root': { fontSize: 15 } }}>Accept</Button>
                    <Button size="small" variant="outlined" color="error" startIcon={<CloseRounded />} onClick={() => void decideApplication(row, 'rejected')} sx={{ minHeight: 29, minWidth: 0, px: { xs: .85, xl: 1 }, fontSize: 10.5, fontWeight: 850, textTransform: 'none', '& .MuiButton-startIcon': { mr: .4, ml: 0 }, '& .MuiSvgIcon-root': { fontSize: 15 } }}>Reject</Button>
                  </>}
                  {accepted && <Tooltip title="Open agreement"><IconButton size="small" aria-label={`Open agreement for ${applicationNumber}`} onClick={() => openRecord(row)} sx={{ width: 30, height: 30, color: '#0B5270', border: '1px solid rgba(11,82,112,.14)', bgcolor: '#F6FBFC' }}><DescriptionRounded sx={{ fontSize: 17 }} /></IconButton></Tooltip>}
                  <Tooltip title="View application"><IconButton size="small" aria-label={`View ${applicationNumber}`} onClick={() => openRecord(row)} sx={{ width: 30, height: 30, color: '#0B5270', border: '1px solid rgba(11,82,112,.14)', bgcolor: '#F6FBFC' }}><VisibilityRounded sx={{ fontSize: 17 }} /></IconButton></Tooltip>
                  {canEdit && <Tooltip title="Edit application"><IconButton className="sa-edit-icon-button" size="small" aria-label={`Edit ${applicationNumber}`} onClick={() => openDialog('edit', row)} sx={{ width: 30, height: 30, color: '#0B5270', border: '1px solid rgba(11,82,112,.14)', bgcolor: '#F6FBFC' }}><EditRounded sx={{ fontSize: 17 }} /></IconButton></Tooltip>}
                  <Tooltip title="More actions"><IconButton size="small" aria-label={`More actions for ${applicationNumber}`} onClick={(event) => { setActionAnchor(event.currentTarget); setActionRow(row); }} sx={{ width: 30, height: 30, color: '#0B5270', border: '1px solid rgba(11,82,112,.14)', bgcolor: '#F6FBFC' }}><MoreVertRounded sx={{ fontSize: 18 }} /></IconButton></Tooltip>
                </Stack>

                <Box sx={{ gridArea: 'date', minWidth: 0, textAlign: { xs: 'right', md: 'left' } }}>
                  <Typography className="sa-application-record-label" sx={{ color: '#71858A', fontSize: 9, fontWeight: 850, letterSpacing: '.07em', textTransform: 'uppercase' }}>Applied</Typography>
                  <Typography className="sa-application-record-value" noWrap sx={{ mt: .15, color: '#31474C', fontSize: { xs: 11, md: 10.5, xl: 12 }, fontWeight: 750 }}>{applicationDate}</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>;
        })}
      </Stack>
    ) : module === 'tenancies' ? (
      <Stack className="sa-tenancies-record-list" data-secureasset-tenancy-record-list="dashboard-rows-v1" spacing={{ xs: 1, sm: 1.25 }}>
        {rows.map((row) => {
          const tenantName = formatCell(row.tenant, 'user');
          const property = row.property && typeof row.property === 'object' ? row.property : {};
          const propertyName = property.title || property.name || property.code || formatCell(row.property, 'property');
          const space = row.space && typeof row.space === 'object' ? row.space : {};
          const rentalUnit = row.rentalUnit && typeof row.rentalUnit === 'object' ? row.rentalUnit : {};
          const roomName = space.name || space.roomNumber || space.flatNumber || space.apartmentNumber || space.code
            || rentalUnit.name || rentalUnit.roomNumber || rentalUnit.flatNumber || rentalUnit.apartmentNumber || '';
          const status = String(row.status || 'reserved').toLowerCase();
          const statusTone = ['active'].includes(status)
            ? { color: '#176B4D', background: '#E7F5EE', border: 'rgba(23,107,77,.18)' }
            : ['completed', 'closed'].includes(status)
              ? { color: '#315C70', background: '#EDF5F8', border: 'rgba(49,92,112,.18)' }
              : ['cancelled'].includes(status)
                ? { color: '#A43F40', background: '#FCEEEE', border: 'rgba(164,63,64,.18)' }
                : { color: '#8A5A12', background: '#FFF5E2', border: 'rgba(138,90,18,.2)' };
          const startsOn = formatRecordDate(row.startDate);
          const endsOn = formatRecordDate(row.endDate);
          const schedule = `Due day ${row.dueDay || '—'} · ${formatDueTime(row.dueTime)}`;
          const clickable = Boolean(row?._id);
          const open = () => { if (clickable) openRecord(row); };
          const handleKeyDown = (event: KeyboardEvent) => {
            if (!clickable || !['Enter', ' '].includes(event.key)) return;
            event.preventDefault();
            open();
          };
          return <Card
            key={row._id}
            className="sa-surface-card sa-tenancy-record-row"
            elevation={0}
            onClick={clickable ? open : undefined}
            onKeyDown={handleKeyDown}
            role={clickable ? 'button' : undefined}
            tabIndex={clickable ? 0 : undefined}
            aria-label={clickable ? `Open tenancy for ${tenantName} at ${propertyName}` : undefined}
            sx={{
              overflow: 'hidden',
              border: '1px solid rgba(11,82,112,.15)',
              borderRadius: { xs: '10px', lg: '12px' },
              background: 'linear-gradient(145deg, #FFFFFF 0%, #F8FCFD 100%)',
              boxShadow: '0 5px 18px rgba(15,47,57,.045)',
              cursor: clickable ? 'pointer' : 'default',
              transition: 'border-color .18s ease, transform .18s ease, box-shadow .18s ease',
              '&:hover': clickable ? { borderColor: '#0B5270', transform: 'translateY(-1px)', boxShadow: '0 12px 24px rgba(11,82,112,.09)' } : undefined,
              '&:focus-visible': clickable ? { outline: '2px solid #0B5270', outlineOffset: 2 } : undefined,
            }}
          >
            <CardContent sx={{ p: { xs: 1.2, sm: 1.5, xl: 1.7 }, '&:last-child': { pb: { xs: 1.2, sm: 1.5, xl: 1.7 } } }}>
              <Box
                className="sa-tenancy-record-grid"
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '52px minmax(0, 1fr) auto', lg: '58px minmax(130px, 1fr) minmax(150px, 1.15fr) minmax(180px, 1.35fr) minmax(92px, .72fr) auto', xl: '72px minmax(160px, 1fr) minmax(190px, 1.25fr) minmax(220px, 1.4fr) minmax(108px, .75fr) auto' },
                  gridTemplateAreas: { xs: '"image tenant actions" "property property property" "schedule schedule status"', lg: '"image tenant property schedule status actions"' },
                  alignItems: 'center',
                  columnGap: { xs: 1, md: 1.2, xl: 1.5 },
                  rowGap: { xs: 1.05, lg: .7 },
                  minWidth: 0,
                }}
              >
                <ApplicationPropertyThumbnail property={property} />

                <Box className="sa-tenancy-record-tenant" sx={{ gridArea: 'tenant', minWidth: 0 }}>
                  <Typography className="sa-tenancy-record-label">Tenant name</Typography>
                  <Typography className="sa-tenancy-record-title" noWrap title={tenantName}>{tenantName}</Typography>
                  {roomName && <Typography className="sa-tenancy-record-subtitle" noWrap title={String(roomName)}>Room · {roomName}</Typography>}
                </Box>

                <Box className="sa-tenancy-record-property" sx={{ gridArea: 'property', minWidth: 0 }}>
                  <Typography className="sa-tenancy-record-label">Property name</Typography>
                  <Typography className="sa-tenancy-record-title" noWrap title={String(propertyName)}>{propertyName}</Typography>
                  <Stack className="sa-tenancy-record-rent" direction="row" justifyContent="space-between" alignItems="baseline" gap={1}>
                    <Typography className="sa-tenancy-record-subtitle">Monthly rent</Typography>
                    <Typography className="sa-tenancy-record-rent-value" noWrap>{formatCell(row.monthlyRent, 'money')}</Typography>
                  </Stack>
                </Box>

                <Box className="sa-tenancy-record-schedule" sx={{ gridArea: 'schedule', minWidth: 0 }}>
                  <Typography className="sa-tenancy-record-label">Due day and time</Typography>
                  <Typography className="sa-tenancy-record-schedule-value" noWrap title={schedule}>{schedule}</Typography>
                  <Typography className="sa-tenancy-record-subtitle sa-tenancy-record-dates" title={`Start ${startsOn} · End ${endsOn}`}>Start {startsOn} · End {endsOn}</Typography>
                </Box>

                <Stack className="sa-tenancy-record-status" sx={{ gridArea: 'status', minWidth: 0 }} spacing={.45} alignItems="flex-start">
                  <Typography className="sa-tenancy-record-label">Status</Typography>
                  <Chip size="small" label={optionText(status)} sx={{ maxWidth: '100%', height: 25, color: statusTone.color, bgcolor: statusTone.background, border: `1px solid ${statusTone.border}`, '& .MuiChip-label': { px: .9, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 10.5, fontWeight: 800 } }} />
                </Stack>

                <Stack
                  className="sa-tenancy-record-actions"
                  sx={{ gridArea: 'actions', minWidth: 0 }}
                  direction="row"
                  alignItems="center"
                  justifyContent="flex-end"
                  gap={.35}
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                >
                  <Tooltip title="View tenancy"><IconButton size="small" aria-label={`View tenancy for ${tenantName}`} onClick={open} sx={{ width: 30, height: 30, color: '#0B5270', border: '1px solid rgba(11,82,112,.14)', bgcolor: '#F6FBFC' }}><VisibilityRounded sx={{ fontSize: 17 }} /></IconButton></Tooltip>
                  {canEdit && <Tooltip title="Edit tenancy"><IconButton className="sa-edit-icon-button" size="small" aria-label={`Edit tenancy for ${tenantName}`} onClick={() => openDialog('edit', row)} sx={{ width: 30, height: 30, color: '#0B5270', border: '1px solid rgba(11,82,112,.14)', bgcolor: '#F6FBFC' }}><EditRounded sx={{ fontSize: 17 }} /></IconButton></Tooltip>}
                  <Tooltip title="More actions"><IconButton size="small" aria-label={`More actions for tenancy ${row.tenancyNumber || row._id}`} onClick={(event) => { setActionAnchor(event.currentTarget); setActionRow(row); }} sx={{ width: 30, height: 30, color: '#0B5270', border: '1px solid rgba(11,82,112,.14)', bgcolor: '#F6FBFC' }}><MoreVertRounded sx={{ fontSize: 18 }} /></IconButton></Tooltip>
                </Stack>
              </Box>
            </CardContent>
          </Card>;
        })}
      </Stack>
    ) : mobile ? (
      <Box data-secureasset-property-mobile-list={module === 'properties' ? 'portfolio-v154' : undefined} sx={module === 'properties' ? { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1 } : { display: 'flex', flexDirection: 'column', gap: 1.2 }}>
        {module === 'properties' ? rows.map((row) => <PropertyPortfolioMobileCard
          key={row._id}
          row={row}
          onOpen={() => openRecord(row)}
          onEdit={canEdit ? () => openDialog('edit', row) : undefined}
          onManageRooms={() => navigate(`/app/my-listings/${encodeURIComponent(row._id)}/rooms`)}
          onMore={(event) => { event.stopPropagation(); setActionAnchor(event.currentTarget); setActionRow(row); }}
        />) : rows.map((row) => {
          const clickable = Boolean(row?._id);
          const open = () => { if (clickable) openRecord(row); };
          const handleKeyDown = (event: KeyboardEvent) => {
            if (!clickable || !['Enter', ' '].includes(event.key)) return;
            event.preventDefault();
            open();
          };
          return <Card key={row._id} className="sa-surface-card" elevation={0} onClick={clickable ? open : undefined} onKeyDown={handleKeyDown} role={clickable ? 'button' : undefined} tabIndex={clickable ? 0 : undefined} aria-label={clickable ? `Open ${recordLabel(row)} details` : undefined} sx={{ cursor: clickable ? 'pointer' : 'default', transition: 'border-color .18s ease, transform .18s ease', '&:hover': clickable ? { borderColor: '#0F172A', transform: 'translateY(-1px)' } : undefined, '&:focus-visible': clickable ? { outline: '2px solid #0F172A', outlineOffset: 2 } : undefined }}>
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
              <Box sx={{ flex: 1 }}>
                {columns.slice(0, 4).map((column, index) => <Box key={column.path} sx={{ mb: index === 0 ? 1.2 : .7 }}>
                  {index === 0
                    ? <Typography sx={{ fontWeight: 850 }}>{formatCell(getValue(row, column.path), column.type)}</Typography>
                    : <Stack direction="row" justifyContent="space-between" gap={2}>
                      <Typography color="text.secondary" sx={{ fontSize: 11.5 }}>{column.label}</Typography>
                      {column.type === 'status'
                        ? <Chip size="small" label={formatCell(getValue(row, column.path))} />
                        : <Typography sx={{ fontSize: 12, textAlign: 'right' }}>{formatCell(getValue(row, column.path), column.type)}</Typography>}
                    </Stack>}
                </Box>)}
              </Box>
              <IconButton aria-label={`More actions for ${row.name || row.title || 'record'}`} onClick={(event) => { event.stopPropagation(); setActionAnchor(event.currentTarget); setActionRow(row); }} onKeyDown={(event) => event.stopPropagation()}>
                <MoreVertRounded />
              </IconButton>
            </Stack>
            {module === 'applications' && (canDecideApplication(row) || applicationAcceptedStatuses.includes(String(row.status || '').toLowerCase())) && <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={.8}
              alignItems={{ xs: 'stretch', sm: 'center' }}
              sx={{ mt: 1.4 }}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
              data-secureasset-application-actions="direct-decision-v76"
            >
              {canDecideApplication(row) && <>
                <Button
                  size="small"
                  variant="contained"
                  color="success"
                  startIcon={<CheckCircleRounded fontSize="small" />}
                  onClick={() => void decideApplication(row, 'approved')}
                  sx={{ fontWeight: 800 }}
                >Accept</Button>
                <Button
                  size="small"
                  variant="outlined"
                  color="error"
                  startIcon={<CloseRounded fontSize="small" />}
                  onClick={() => void decideApplication(row, 'rejected')}
                  sx={{ fontWeight: 800 }}
                >Reject</Button>
              </>}
              {applicationAcceptedStatuses.includes(String(row.status || '').toLowerCase()) && <Button
                size="small"
                variant="outlined"
                color="primary"
                startIcon={<DescriptionRounded fontSize="small" />}
                onClick={() => openRecord(row)}
                sx={{ fontWeight: 800 }}
              >Open agreement</Button>}
            </Stack>}
          </CardContent>
        </Card>;
        })}
      </Box>
    ) : (
      <TableContainer component={Paper} className="sa-surface-card" elevation={0} sx={{ overflow: 'hidden', borderRadius: 4 }}>
        <Table>
          <TableHead><TableRow>{columns.map((column) => <TableCell key={column.path}>{column.label}</TableCell>)}<TableCell align="right">Actions</TableCell></TableRow></TableHead>
          <TableBody>{rows.map((row) => {
            const clickable = Boolean(row?._id);
            const open = () => { if (clickable) openRecord(row); };
            const handleKeyDown = (event: KeyboardEvent) => {
              if (!clickable || !['Enter', ' '].includes(event.key)) return;
              event.preventDefault();
              open();
            };
            return <TableRow key={row._id} hover onClick={clickable ? open : undefined} onKeyDown={handleKeyDown} role={clickable ? 'button' : undefined} tabIndex={clickable ? 0 : undefined} aria-label={clickable ? `Open ${recordLabel(row)} details` : undefined} sx={{ cursor: clickable ? 'pointer' : 'default', '&:focus-visible': clickable ? { outline: '2px solid #0F172A', outlineOffset: -2 } : undefined }}>
            {columns.map((column, index) => <TableCell key={column.path} sx={{ fontSize: 13, fontWeight: index === 0 ? 760 : 520, maxWidth: 260 }}>
              {index === 0 && clickable
                ? <ButtonBase onClick={(event) => { event.stopPropagation(); open(); }} aria-label={`Open ${recordLabel(row)} details`} sx={{ display: 'inline-flex', alignItems: 'center', gap: .6, maxWidth: '100%', textAlign: 'left', color: 'primary.main', fontWeight: 800, '&:hover': { textDecoration: 'underline' } }}>
                  <Typography component="span" sx={{ fontSize: 13, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{formatCell(getValue(row, column.path), column.type)}</Typography>
                  <ArrowOutwardRounded sx={{ fontSize: 15, flex: '0 0 auto' }} />
                </ButtonBase>
                : column.type === 'status' ? column.path === 'visibility' && module === 'properties' && canEdit
                  ? <Chip
                    size="small"
                    label={formatCell(getValue(row, column.path))}
                    variant="outlined"
                    clickable
                    onClick={(event) => { event.stopPropagation(); void changeVisibility(row); }}
                    aria-label={`Change ${recordLabel(row)} visibility; currently ${formatCell(getValue(row, column.path))}`}
                    title="Click to change visibility"
                  />
                  : <Chip size="small" label={formatCell(getValue(row, column.path))} variant="outlined" />
                  : formatCell(getValue(row, column.path), column.type)}
            </TableCell>)}
            <TableCell align="right" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
              <Stack direction="row" spacing={.45} justifyContent="flex-end" alignItems="center" flexWrap="wrap" useFlexGap>
                {module === 'applications' && canDecideApplication(row) && <>
                  <Button
                    size="small"
                    variant="contained"
                    color="success"
                    startIcon={<CheckCircleRounded fontSize="small" />}
                    onClick={(event) => { event.stopPropagation(); void decideApplication(row, 'approved'); }}
                    sx={{ minWidth: 0, px: 1.05, fontWeight: 800, whiteSpace: 'nowrap' }}
                  >Accept</Button>
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    startIcon={<CloseRounded fontSize="small" />}
                    onClick={(event) => { event.stopPropagation(); void decideApplication(row, 'rejected'); }}
                    sx={{ minWidth: 0, px: 1.05, fontWeight: 800, whiteSpace: 'nowrap' }}
                  >Reject</Button>
                </>}
                {module === 'applications' && applicationAcceptedStatuses.includes(String(row.status || '').toLowerCase()) && <Button
                  size="small"
                  variant="outlined"
                  color="primary"
                  startIcon={<DescriptionRounded fontSize="small" />}
                  onClick={(event) => { event.stopPropagation(); openRecord(row); }}
                  sx={{ minWidth: 0, px: 1.05, fontWeight: 800, whiteSpace: 'nowrap' }}
                >Agreement</Button>}
                <Tooltip title={`View ${config.singular.toLowerCase()}`}><IconButton size="small" aria-label={`Open ${recordLabel(row)} details`} onClick={openRecord.bind(null, row)}><VisibilityRounded fontSize="small" /></IconButton></Tooltip>
                {canEdit && !isManagedRentalPayment(row) && <Tooltip title="Edit"><IconButton className="sa-edit-icon-button" size="small" onClick={() => openDialog('edit', row)}><EditRounded fontSize="small" /></IconButton></Tooltip>}
                <IconButton size="small" aria-label={`More actions for ${row.name || row.title || 'record'}`} onClick={(event) => { setActionAnchor(event.currentTarget); setActionRow(row); }}><MoreVertRounded fontSize="small" /></IconButton>
              </Stack>
            </TableCell>
          </TableRow>;
          })}</TableBody>
        </Table>
      </TableContainer>
    )}

    {pagination.totalPages > 1 && <Stack alignItems="center" sx={{ mt: 3 }}><Pagination page={pagination.page} count={pagination.totalPages} onChange={(_e, page) => { setPagination((p) => ({ ...p, page })); load(page); }} color="primary" /></Stack>}

    <Menu anchorEl={actionAnchor} open={Boolean(actionAnchor)} onClose={() => setActionAnchor(null)}>
      {actionRow && <MenuItem onClick={() => { setActionAnchor(null); openRecord(actionRow); }}>View details</MenuItem>}
      {module === 'payments' && actionRow && String(actionRow.type || '').startsWith('survey_') && actionRow.status !== 'paid' && idOf(actionRow.payer) === user?._id && <MenuItem onClick={() => payInvoice(actionRow)}>Pay survey invoice</MenuItem>}
      {module === 'payments' && actionRow && isManagedRentalPayment(actionRow) && idOf(actionRow.payer) === user?._id && ['awaiting_tenant', 'rejected'].includes(actionRow.paymentVerification?.status || 'awaiting_tenant') && <MenuItem sx={{ color: 'primary.main', fontWeight: 800 }} onClick={() => openRentPayment(actionRow)}>Pay rent invoice</MenuItem>}
      {module === 'payments' && actionRow && isManagedRentalPayment(actionRow) && idOf(actionRow.payee) === user?._id && actionRow.paymentVerification?.status === 'submitted' && <MenuItem sx={{ color: '#238062', fontWeight: 800 }} onClick={() => acceptRentPayment(actionRow)}>Accept rent payment</MenuItem>}
      {module === 'payments' && actionRow && isManagedRentalPayment(actionRow) && idOf(actionRow.payee) === user?._id && actionRow.paymentVerification?.status === 'submitted' && <MenuItem sx={{ color: 'error.main', fontWeight: 800 }} onClick={() => rejectRentPayment(actionRow)}>Reject rent payment</MenuItem>}
      {module === 'survey-quotations' && actionRow && idOf(actionRow.client) === user?._id && ['submitted','viewed','under_negotiation','revised'].includes(actionRow.status) && <MenuItem onClick={() => acceptQuotation(actionRow)}>Accept quotation & create project</MenuItem>}
      {module === 'survey-reports' && actionRow && !['locked','cancelled'].includes(actionRow.status) && idOf(actionRow.surveyor) === user?._id && <MenuItem onClick={() => lockReport(actionRow)}>Finalize & lock report</MenuItem>}
      {module === 'survey-reports' && actionRow && <MenuItem onClick={() => exportSurveyReport(actionRow, 'pdf')}>Export report PDF</MenuItem>}
      {module === 'survey-reports' && actionRow && <MenuItem onClick={() => exportSurveyReport(actionRow, 'xlsx')}>Export report Excel</MenuItem>}
      {module === 'survey-reports' && actionRow && <MenuItem onClick={() => exportSurveyReport(actionRow, 'csv')}>Export report CSV</MenuItem>}
      {module === 'subscriptions' && actionRow && actionRow.status === 'pending' && user?.role === 'admin' && <><MenuItem sx={{ color: '#238062', fontWeight: 850 }} onClick={() => acceptTenantSubscription(actionRow)}>Accept & activate tenant subscription</MenuItem><MenuItem sx={{ color: 'error.main', fontWeight: 850 }} onClick={() => rejectTenantSubscriptionOrder(actionRow)}>Reject subscription</MenuItem></>}
      {module === 'properties' && actionRow && canEdit && <MenuItem onClick={() => void changeVisibility(actionRow)}>{actionRow.visibility === 'public' ? 'Make private' : 'Make public'}</MenuItem>}
      {module === 'properties' && actionRow && canEdit && (actionRow.purpose || actionRow.listingType) === 'rent' && <MenuItem sx={{ color: 'primary.main', fontWeight: 850 }} onClick={() => { setActionAnchor(null); navigate(`/app/my-listings/${encodeURIComponent(actionRow._id)}/rooms`); }}>Manage Rooms & Tenancy</MenuItem>}
      {module === 'applications' && actionRow && canDecideApplication(actionRow) && <><MenuItem sx={{ color: 'success.main', fontWeight: 850 }} onClick={() => { setActionAnchor(null); void decideApplication(actionRow, 'approved'); }}>Accept application</MenuItem><MenuItem sx={{ color: 'error.main', fontWeight: 850 }} onClick={() => { setActionAnchor(null); void decideApplication(actionRow, 'rejected'); }}>Reject application</MenuItem></>}
      {module === 'applications' && actionRow && applicationAcceptedStatuses.includes(String(actionRow.status || '').toLowerCase()) && <MenuItem onClick={() => { setActionAnchor(null); openRecord(actionRow); }}>View application details & agreement</MenuItem>}
      {config.statuses && canEdit && module !== 'subscriptions' && !isManagedRentalPayment(actionRow) && (module === 'applications' ? applicationStatusOptions(actionRow) : config.statuses).map((item) => <MenuItem key={item} onClick={() => changeStatus(item)}>{optionText(item)}</MenuItem>)}
      {canEdit && module !== 'subscriptions' && !isManagedRentalPayment(actionRow) && <MenuItem sx={{ color: '#D97706' }} onClick={() => { setActionAnchor(null); openDialog('edit', actionRow); }}>Edit</MenuItem>}
      {canDelete && <MenuItem sx={{ color: 'error.main' }} onClick={() => { setActionAnchor(null); remove(actionRow); }}><DeleteOutlineRounded fontSize="small" sx={{ mr: 1 }} />Delete</MenuItem>}
    </Menu>

    <Menu
      anchorEl={exportMenuAnchor}
      open={Boolean(exportMenuAnchor)}
      onClose={() => setExportMenuAnchor(null)}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
    >
      <MenuItem onClick={() => exportResource('csv')}><FileDownloadRounded fontSize="small" sx={{ mr: 1 }} />Export CSV</MenuItem>
      <MenuItem onClick={() => exportResource('xlsx')}><FileDownloadRounded fontSize="small" sx={{ mr: 1 }} />Export Excel</MenuItem>
      <MenuItem onClick={() => exportResource('pdf')}><FileDownloadRounded fontSize="small" sx={{ mr: 1 }} />Export PDF</MenuItem>
    </Menu>

    {module === 'properties' && dialog && dialog.mode !== 'view' && <PropertyFormWizard
      open
      mode={dialog.mode}
      property={dialog.row}
      propertyTypes={siteData.propertyTypes || []}
      onClose={() => setDialog(null)}
      onSaved={(message) => { setDialog(null); setNotice(message); void load(); }}
    />}
    {!(module === 'properties' && dialog && dialog.mode !== 'view') && <ProfessionalDialog open={Boolean(dialog)} onClose={() => setDialog(null)} fullWidth maxWidth="md">
      <DialogTitle sx={{ fontWeight: 900 }}>{dialog?.mode === 'view' ? `${config.singular} details` : dialog?.mode === 'edit' ? `Edit ${config.singular}` : `Add ${config.singular}`}</DialogTitle>
      {dialog?.mode === 'view' ? <DialogContent dividers>
        {module === 'properties' ? <PropertyFullDetailsView property={dialog.row} /> : module === 'applications' ? <Stack spacing={1.2}>
          {columns.map((column) => <Stack key={column.path} direction="row" justifyContent="space-between" gap={3}><Typography color="text.secondary" sx={{ fontSize: 12 }}>{column.label}</Typography><Typography sx={{ fontSize: 13, textAlign: 'right', fontWeight: 650 }}>{formatCell(getValue(dialog.row, column.path), column.type)}</Typography></Stack>)}
          <ApplicationAgreementPanel application={dialog.row} user={user} landlordCanManage={Boolean(canEdit && isApplicationLandlordSide(dialog.row))} onDecision={(next) => decideApplication(dialog.row, next)} onNotice={setNotice} onError={setError} />
        </Stack> : <Stack spacing={1.2}>{columns.map((column) => <Stack key={column.path} direction="row" justifyContent="space-between" gap={3}><Typography color="text.secondary" sx={{ fontSize: 12 }}>{column.label}</Typography><Typography sx={{ fontSize: 13, textAlign: 'right', fontWeight: 650 }}>{formatCell(getValue(dialog.row, column.path), column.type)}</Typography></Stack>)}</Stack>}
      </DialogContent> : <Box component="form" onSubmit={submit}><DialogContent dividers><Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>{module === 'documents' && dialog?.mode === 'create' && <Button component="label" variant="outlined" startIcon={<UploadFileRounded />} sx={{ minHeight: 56, gridColumn: '1 / -1' }}>{file?.name || 'Select document'}<input hidden type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} /></Button>}{activeFields.map((field) => {
        const location = locationPaths(field.name);
        if (isLocationSecondary(field.name)) return null;
        if (location) {
          const countryField = activeFields.find((candidate) => candidate.name === location.country);
          const stateField = activeFields.find((candidate) => candidate.name === location.state);
          const cityField = activeFields.find((candidate) => candidate.name === location.city);
          return <LocationFields key={field.name} value={{ country: form[location.country], state: form[location.state], city: form[location.city] }} required={{ country: countryField?.required, state: stateField?.required, city: cityField?.required }} onChange={(next) => setForm((old) => ({ ...old, [location.country]: next.country || '', [location.state]: next.state || '', [location.city]: next.city || '' }))} />;
        }
        if (field.type === 'image') {
          const preview = imageFiles[field.name] ? URL.createObjectURL(imageFiles[field.name] as File) : String(form[field.name] || '');
          const carouselHint = module === 'home-carousel' && field.name === 'imageUrl' ? 'Wide desktop image · recommended 1920 × 720 px.' : module === 'home-carousel' && field.name === 'mobileImageUrl' ? 'Portrait mobile image · recommended 1080 × 1350 px.' : 'Upload JPG, PNG, WebP or GIF.';
          return <Paper key={field.name} variant="outlined" sx={{ p: 1.5, borderRadius: 3, display: 'flex', alignItems: 'center', gap: 1.5, gridColumn: { xs: '1 / -1', sm: 'auto' } }}><Avatar variant="rounded" src={preview} sx={{ width: 72, height: 52, bgcolor: 'action.hover' }} /><Box sx={{ minWidth: 0, flex: 1 }}><Typography fontWeight={800} fontSize={13}>{field.label}</Typography><Typography color="text.secondary" fontSize={11.5}>{carouselHint}</Typography></Box><Stack direction="row" spacing={.5}><Button component="label" size="small" variant="outlined" startIcon={<PhotoCameraRounded />}>Choose<input hidden type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => setImageFiles((old) => ({ ...old, [field.name]: event.target.files?.[0] || null }))} /></Button>{preview && <IconButton color="error" size="small" aria-label={`Remove ${field.label}`} onClick={() => { setImageFiles((old) => ({ ...old, [field.name]: null })); setForm((old) => ({ ...old, [field.name]: '' })); }}><DeleteOutlineRounded fontSize="small" /></IconButton>}</Stack></Paper>;
        }
        const propertyTypeOptions = field.name === 'type' && module === 'properties' ? (siteData.propertyTypes || []).filter((item: any) => item.active !== false).map((item: any) => ({ value: item.key, label: item.label })) : null;
        const areaUnitOptions = field.name === 'areas.unit' && module === 'properties' ? (siteData.areaUnits || []).filter((item: any) => item.active !== false).map((item: any) => ({ value: item.key, label: `${item.label}${item.symbol ? ` (${item.symbol})` : ''}` })) : null;
        const selectedPropertyType = module === 'properties' ? (siteData.propertyTypes || []).find((item: any) => item.key === form.type) : null;
        const purposeOptions = field.name === 'purpose' && selectedPropertyType?.allowedPurposes?.length ? selectedPropertyType.allowedPurposes.map((item: string) => ({ value: item, label: optionText(item) })) : null;
        const common = { key: field.name, label: field.label, required: Boolean(field.required && !(field.name === 'password' && dialog?.mode === 'edit')), value: form[field.name] ?? '', onChange: (e: any) => setForm((old) => ({ ...old, [field.name]: e.target.value })), fullWidth: true, size: 'small' as const };
        if (field.type === 'select') {
          const selectOptions = propertyTypeOptions || areaUnitOptions || purposeOptions || (field.options || []).map((option) => ({ value: option, label: optionText(option) }));
          return <TextField {...common} select onChange={(e: any) => setForm((old) => {
            const next = { ...old, [field.name]: e.target.value };
            if (module === 'properties' && field.name === 'type') {
              const selected = (siteData.propertyTypes || []).find((item: any) => item.key === e.target.value);
              next.hierarchyMode = selected?.hierarchyMode || 'simple';
              if (selected?.allowedPurposes?.length && !selected.allowedPurposes.includes(next.purpose)) next.purpose = selected.allowedPurposes[0];
              if (e.target.value !== 'other') next.customType = '';
            }
            return next;
          })}>{selectOptions.map((option: any) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}</TextField>;
        }
        if (field.type === 'reference') return <TextField {...common} select><MenuItem value="">Not assigned</MenuItem>{(options[field.reference || ''] || []).filter((item) => field.reference !== 'users' || !field.name.toLowerCase().includes('surveyor') || (item.role === 'surveyor' || item.surveyorEnabled)).map((item) => <MenuItem key={item._id} value={item._id}>{optionLabel(item)}</MenuItem>)}</TextField>;
        if (field.type === 'radio') {
          const radioOptions = field.options?.length ? field.options : ['true', 'false'];
          return <FormControl key={field.name} component="fieldset" fullWidth sx={{ minHeight: 40 }}>
            <Typography component="legend" sx={{ fontSize: 12, fontWeight: 800, color: 'text.secondary', mb: .35 }}>{field.label}</Typography>
            <RadioGroup row value={String(Boolean(form[field.name]))} onChange={(event) => setForm((old) => ({ ...old, [field.name]: event.target.value === 'true' }))}>
              {radioOptions.map((option) => <FormControlLabel key={option} value={option} control={<Radio size="small" />} label={option === 'true' ? 'Enabled' : 'Disabled'} />)}
            </RadioGroup>
          </FormControl>;
        }
        if (field.type === 'boolean') return <TextField {...common} select value={String(Boolean(form[field.name]))} onChange={(e) => setForm((old) => ({ ...old, [field.name]: e.target.value === 'true' }))}><MenuItem value="true">Yes</MenuItem><MenuItem value="false">No</MenuItem></TextField>;
        return <TextField {...common} type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'time' ? 'time' : field.type === 'datetime' ? 'datetime-local' : field.type === 'password' ? 'password' : 'text'} multiline={field.type === 'textarea' || field.type === 'json'} rows={field.type === 'textarea' || field.type === 'json' ? 4 : undefined} InputLabelProps={['date', 'time', 'datetime'].includes(field.type || '') ? { shrink: true } : undefined} sx={{ gridColumn: ['textarea', 'json'].includes(field.type || '') ? '1 / -1' : undefined }} />;
      })}</Box></DialogContent><DialogActions sx={{ p: 2 }}><Button className="sa-danger-button" variant="outlined" onClick={() => setDialog(null)}>Cancel</Button><Button className="sa-submit-button" type="submit" variant="contained">Save</Button></DialogActions></Box>}
      {dialog?.mode === 'view' && <DialogActions sx={{ p: 2 }}><Button onClick={() => setDialog(null)}>Close</Button>{canEdit && !isManagedRentalPayment(dialog.row) && <Button className="sa-edit-button" variant="contained" onClick={() => openDialog('edit', dialog.row)}>Edit</Button>}</DialogActions>}
    </ProfessionalDialog>}
    <ProfessionalDialog open={Boolean(rentPaymentDialog)} onClose={() => !rentPaymentBusy && setRentPaymentDialog(null)} fullWidth maxWidth="sm" professionalTitle="Pay rent invoice" professionalSubtitle="Your landlord will verify the payment before the invoice is marked paid." enableMinimize={false}>
      <Box component="form" onSubmit={submitRentPayment}>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Alert severity="info">Invoice {rentPaymentDialog?.rentalInvoice?.invoiceNumber || rentPaymentDialog?.invoiceNumber || '—'} · {formatCell(rentPaymentDialog?.amount, 'money')}. Submit the payment details; the landlord must accept it.</Alert>
            <TextField select required label="Payment method" value={rentPaymentForm.method} onChange={(event) => setRentPaymentForm((current) => ({ ...current, method: event.target.value }))}>
              <MenuItem value="upi">UPI</MenuItem><MenuItem value="bank_transfer">Bank transfer</MenuItem><MenuItem value="card">Card</MenuItem><MenuItem value="cash">Cash</MenuItem><MenuItem value="cheque">Cheque</MenuItem><MenuItem value="offline">Offline / other</MenuItem>
            </TextField>
            <TextField label="Transaction / receipt reference" value={rentPaymentForm.transactionId} onChange={(event) => setRentPaymentForm((current) => ({ ...current, transactionId: event.target.value }))} helperText="Recommended for digital payments. A reference cannot be reused." />
            <TextField label="Payment proof URL (optional)" value={rentPaymentForm.proofUrl} onChange={(event) => setRentPaymentForm((current) => ({ ...current, proofUrl: event.target.value }))} />
            <TextField label="Note for landlord (optional)" value={rentPaymentForm.notes} onChange={(event) => setRentPaymentForm((current) => ({ ...current, notes: event.target.value }))} multiline minRows={3} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button className="sa-danger-button" variant="outlined" disabled={rentPaymentBusy} onClick={() => setRentPaymentDialog(null)}>Cancel</Button>
          <Button className="sa-submit-button" type="submit" variant="contained" disabled={rentPaymentBusy}>{rentPaymentBusy ? 'Submitting…' : 'Submit for approval'}</Button>
        </DialogActions>
      </Box>
    </ProfessionalDialog>
    {actions.dialogs}
    <Snackbar open={Boolean(notice)} autoHideDuration={3500} onClose={() => setNotice('')} message={notice} />
  </Box>;
}

export const supportedResources = Object.keys(configs);
