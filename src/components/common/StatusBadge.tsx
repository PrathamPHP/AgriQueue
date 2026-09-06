import React from 'react';
import { cn } from '@/lib/utils';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  AlertTriangle,
  XCircle,
  UserCheck,
  Scale,
  ShieldCheck,
  CreditCard,
  Ban,
} from 'lucide-react';
import { SlotStatus, ProcurementStage, PaymentStatus } from '@/types';

export type BadgeType =
  | SlotStatus
  | ProcurementStage
  | PaymentStatus
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral'
  | 'priority';

interface StatusBadgeProps {
  status: BadgeType;
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  size = 'md',
  className,
}) => {
  // Define styling and icon per status type
  const getBadgeConfig = (): {
    bg: string;
    text: string;
    border: string;
    defaultLabel: string;
    icon: React.ReactNode;
  } => {
    switch (status) {
      // Slot Congestion Statuses (PRD Sec 18)
      case 'AVAILABLE':
        return {
          bg: 'bg-[#DCFCE7]',
          text: 'text-[#166534]',
          border: 'border-emerald-200',
          defaultLabel: 'Available (<70%)',
          icon: <CheckCircle2 className="w-3.5 h-3.5" />,
        };
      case 'FILLING_FAST':
        return {
          bg: 'bg-[#FEF3C7]',
          text: 'text-[#92400E]',
          border: 'border-amber-200',
          defaultLabel: 'Filling Fast (70–95%)',
          icon: <AlertTriangle className="w-3.5 h-3.5" />,
        };
      case 'FULL':
        return {
          bg: 'bg-[#FEE2E2]',
          text: 'text-[#991B1B]',
          border: 'border-red-200',
          defaultLabel: 'Full (≥95%)',
          icon: <Ban className="w-3.5 h-3.5" />,
        };

      // Procurement Workflow Stages (PRD Sec 22)
      case 'BOOKED':
        return {
          bg: 'bg-slate-100',
          text: 'text-slate-800',
          border: 'border-slate-200',
          defaultLabel: 'Slot Booked',
          icon: <Clock className="w-3.5 h-3.5" />,
        };
      case 'ARRIVED':
        return {
          bg: 'bg-blue-50',
          text: 'text-blue-800',
          border: 'border-blue-200',
          defaultLabel: 'Arrived at Gate',
          icon: <UserCheck className="w-3.5 h-3.5" />,
        };
      case 'CHECKED_IN':
        return {
          bg: 'bg-cyan-50',
          text: 'text-cyan-800',
          border: 'border-cyan-200',
          defaultLabel: 'Checked In',
          icon: <UserCheck className="w-3.5 h-3.5" />,
        };
      case 'WAITING':
        return {
          bg: 'bg-slate-100',
          text: 'text-slate-700',
          border: 'border-slate-300',
          defaultLabel: 'In Queue (Waiting)',
          icon: <Clock className="w-3.5 h-3.5" />,
        };
      case 'NOW_SERVING':
        return {
          bg: 'bg-[#DCFCE7]',
          text: 'text-[#166534]',
          border: 'border-emerald-300',
          defaultLabel: 'Now Serving',
          icon: <CheckCircle2 className="w-3.5 h-3.5" />,
        };
      case 'VERIFICATION':
        return {
          bg: 'bg-indigo-50',
          text: 'text-indigo-800',
          border: 'border-indigo-200',
          defaultLabel: 'Identity Verification',
          icon: <ShieldCheck className="w-3.5 h-3.5" />,
        };
      case 'QUALITY_CHECK':
        return {
          bg: 'bg-amber-50',
          text: 'text-amber-800',
          border: 'border-amber-200',
          defaultLabel: 'Quality Check',
          icon: <AlertCircle className="w-3.5 h-3.5" />,
        };
      case 'WEIGHING':
        return {
          bg: 'bg-teal-50',
          text: 'text-teal-800',
          border: 'border-teal-200',
          defaultLabel: 'Weighing Produce',
          icon: <Scale className="w-3.5 h-3.5" />,
        };
      case 'COMPLETED':
        return {
          bg: 'bg-[#DCFCE7]',
          text: 'text-[#166534]',
          border: 'border-emerald-200',
          defaultLabel: 'Procurement Completed',
          icon: <CheckCircle2 className="w-3.5 h-3.5" />,
        };
      case 'NO_SHOW':
        return {
          bg: 'bg-rose-50',
          text: 'text-rose-800',
          border: 'border-rose-200',
          defaultLabel: 'No-Show',
          icon: <XCircle className="w-3.5 h-3.5" />,
        };

      // Payment Workflow (PRD Sec 23)
      case 'PENDING':
        return {
          bg: 'bg-amber-50',
          text: 'text-amber-800',
          border: 'border-amber-200',
          defaultLabel: 'Payment Pending',
          icon: <Clock className="w-3.5 h-3.5" />,
        };
      case 'INITIATED':
        return {
          bg: 'bg-blue-50',
          text: 'text-blue-800',
          border: 'border-blue-200',
          defaultLabel: 'Payment Initiated',
          icon: <CreditCard className="w-3.5 h-3.5" />,
        };
      case 'PAID':
        return {
          bg: 'bg-[#DCFCE7]',
          text: 'text-[#166534]',
          border: 'border-emerald-200',
          defaultLabel: 'Paid to Bank Account',
          icon: <CheckCircle2 className="w-3.5 h-3.5" />,
        };

      case 'priority':
        return {
          bg: 'bg-purple-50',
          text: 'text-purple-800',
          border: 'border-purple-200',
          defaultLabel: 'Priority Farmer',
          icon: <ShieldCheck className="w-3.5 h-3.5" />,
        };

      // Defaults / Generic
      case 'danger':
        return {
          bg: 'bg-red-50',
          text: 'text-red-700',
          border: 'border-red-200',
          defaultLabel: 'Delayed / Issue',
          icon: <AlertCircle className="w-3.5 h-3.5" />,
        };
      case 'warning':
        return {
          bg: 'bg-amber-50',
          text: 'text-amber-800',
          border: 'border-amber-200',
          defaultLabel: 'Warning',
          icon: <AlertTriangle className="w-3.5 h-3.5" />,
        };
      case 'info':
        return {
          bg: 'bg-blue-50',
          text: 'text-blue-700',
          border: 'border-blue-200',
          defaultLabel: 'Info',
          icon: <Clock className="w-3.5 h-3.5" />,
        };
      case 'success':
      default:
        return {
          bg: 'bg-[#DCFCE7]',
          text: 'text-[#166534]',
          border: 'border-emerald-200',
          defaultLabel: 'Normal',
          icon: <CheckCircle2 className="w-3.5 h-3.5" />,
        };
    }
  };

  const config = getBadgeConfig();
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs gap-1' : 'px-2.5 py-1 text-xs sm:text-sm font-medium gap-1.5';

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-badge border select-none font-medium',
        config.bg,
        config.text,
        config.border,
        sizeClasses,
        className
      )}
    >
      <span className="shrink-0">{config.icon}</span>
      <span>{label || config.defaultLabel}</span>
    </span>
  );
};
