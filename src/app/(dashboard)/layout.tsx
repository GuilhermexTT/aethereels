import React from 'react';
import DashboardClientLayout from './DashboardClientLayout';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardClientLayout>
      {children}
    </DashboardClientLayout>
  );
}
