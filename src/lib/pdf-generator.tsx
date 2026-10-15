import React from 'react';
import { renderToString } from 'react-dom/server';
import { toast } from '@/hooks/use-toast';

interface ProjectReportData {
  project: any;
  team: any[];
  tasks: any[];
}

export const generateProjectReport = (data: ProjectReportData) => {
  const { project, team, tasks } = data;
  
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    toast({
      title: "Popup Blocked",
      description: "Please allow popups to print/download the project summary.",
      variant: "error"
    });
    return;
  }

  const teamHtml = team.map((member: any) => `
    <tr>
      <td style="font-weight: 600;">${member.profiles?.first_name || ""} ${member.profiles?.last_name || ""}</td>
      <td class="capitalize" style="color: #4f46e5; font-weight: 700;">${member.role ? member.role.replace('_', ' ') : 'N/A'}</td>
      <td>${member.profiles?.email || ""}</td>
    </tr>
  `).join("");

  const tasksHtml = tasks.map((task: any) => `
    <tr>
      <td style="font-weight: 600;">${task.title}</td>
      <td class="capitalize">${task.stage ? task.stage.replace('_', ' ') : 'N/A'}</td>
      <td class="status-cell ${task.status?.toLowerCase()}">${task.status ? task.status.toUpperCase() : 'N/A'}</td>
      <td>${task.due_date ? new Date(task.due_date).toLocaleDateString() : 'N/A'}</td>
    </tr>
  `).join("");

  const htmlContent = `
    <html>
      <head>
        <title>Project Report - ${project.name}</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #0f172a;
            margin: 0;
            padding: 40px;
            background-color: #ffffff;
            line-height: 1.5;
          }
          .header {
            background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%);
            color: white;
            padding: 35px;
            border-radius: 24px;
            margin-bottom: 40px;
            box-shadow: 0 10px 25px -5px rgba(79, 70, 229, 0.2);
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 800;
            letter-spacing: -0.03em;
          }
          .header p {
            margin: 6px 0 0 0;
            font-size: 15px;
            opacity: 0.9;
            font-weight: 500;
          }
          .meta-info {
            display: flex;
            justify-content: space-between;
            margin-top: 25px;
            font-size: 12px;
            opacity: 0.85;
            font-family: monospace;
          }
          h2 {
            font-size: 15px;
            font-weight: 800;
            color: #4f46e5;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            margin-top: 40px;
            margin-bottom: 20px;
            border-bottom: 2px solid #f1f5f9;
            padding-bottom: 8px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 35px;
            font-size: 13px;
          }
          th, td {
            padding: 12px 14px;
            text-align: left;
            border-bottom: 1px solid #f1f5f9;
          }
          th {
            background-color: #f8fafc;
            font-weight: 700;
            color: #475569;
            text-transform: uppercase;
            font-size: 11px;
            letter-spacing: 0.05em;
          }
          tr:nth-child(even) {
            background-color: #f8fafc;
          }
          .status-cell {
            font-weight: 700;
            font-size: 11px;
            letter-spacing: 0.05em;
          }
          .status-cell.completed { color: #059669; }
          .status-cell.pending { color: #d97706; }
          .status-cell.in_progress { color: #2563eb; }
          .footer {
            margin-top: 60px;
            text-align: center;
            font-size: 11px;
            color: #94a3b8;
            border-top: 1px solid #f1f5f9;
            padding-top: 20px;
            font-weight: 500;
          }
          @media print {
            body { padding: 0; }
            .header { border-radius: 0; box-shadow: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>MALEE HOUSE SURVEY WORKFLOW</h1>
          <p>Project Status Summary Report</p>
          <div class="meta-info">
            <span>PROJECT: ${project.id}</span>
            <span>DATE: ${new Date().toLocaleString()}</span>
          </div>
        </div>

        <h2>Project Overview</h2>
        <table>
          <thead>
            <tr>
              <th style="width: 30%;">Operational Metric</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Project Name</strong></td>
              <td>${project.name}</td>
            </tr>
            <tr>
              <td><strong>Client Name</strong></td>
              <td>${project.client_name}</td>
            </tr>
            <tr>
              <td><strong>Current Status</strong></td>
              <td style="font-weight: bold; color: #4f46e5; text-transform: uppercase; letter-spacing: 0.05em;">${project.status.replace('_', ' ')}</td>
            </tr>
            <tr>
              <td><strong>Target Date</strong></td>
              <td>${project.target_completion_date ? new Date(project.target_completion_date).toLocaleDateString() : 'N/A'}</td>
            </tr>
          </tbody>
        </table>

        <h2>Project Team</h2>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Email</th>
            </tr>
          </thead>
          <tbody>
            ${teamHtml || '<tr><td colspan="3" style="text-align:center; color:#94a3b8;">No team members assigned.</td></tr>'}
          </tbody>
        </table>

        <h2>Task Progression</h2>
        <table>
          <thead>
            <tr>
              <th>Task Title</th>
              <th>Stage</th>
              <th>Status</th>
              <th>Due Date</th>
            </tr>
          </thead>
          <tbody>
            ${tasksHtml || '<tr><td colspan="4" style="text-align:center; color:#94a3b8;">No tasks recorded.</td></tr>'}
          </tbody>
        </table>

        <div class="footer">
          Malee House Survey Workflow Management · Proprietary & Confidential
        </div>

        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 500);
          };
        </script>
      </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(htmlContent);
  printWindow.document.close();
};

export const generateInvoicePDF = (invoice: any, project: any, companySettings: any, bankDetails?: any) => {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    return;
  }

  const issueDate = new Date(invoice.created_at);
  const dueDate = invoice.due_date ? new Date(invoice.due_date) : null;
  
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const verifiedPayments = (invoice.payments || []).filter((p: any) => p.status === 'verified' || p.status === 'paid');
  const amountPaid = verifiedPayments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
  const totalAmount = Number(invoice.total_amount);
  const remainingAmount = Math.max(0, totalAmount - amountPaid);

  const projectBudget = Number(project?.budget) || 0;
  const projectChecklist = (project as any)?.requirement_checklist;
  const projectGstType = projectChecklist?.gst_type || (invoice as any)?.gst_type;
  const gstType: string = projectGstType === 'igst_5' || projectGstType === 'IGST' ? 'IGST' : 'CGST_SGST';
  const projectPayments = project?.payments || [];
  const projectVerifiedPayments = projectPayments.filter((p: any) => p.status === 'verified' || p.status === 'paid');
  let projectAmountPaid = projectVerifiedPayments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
  if (projectAmountPaid === 0 && amountPaid > 0) {
    projectAmountPaid = amountPaid;
  }
  const projectAmountRemaining = Math.max(0, projectBudget - projectAmountPaid);
  const gstRate = Number(
    invoice.gst_rate ?? (
      Number(invoice.amount) > 0
        ? Math.round((Number(invoice.gst_amount) / Number(invoice.amount)) * 100)
        : 0
    )
  ) || 0;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Invoice - ${invoice.invoice_number}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=Inter:wght@400;500;600;700;800&display=swap');
          
          @page {
            size: A4 portrait;
            margin: 0;
          }
          
          body {
            font-family: 'Inter', -apple-system, sans-serif;
            color: #1e293b;
            margin: 0;
            padding: 0;
            background-color: #f1f5f9;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          .page {
            width: 210mm;
            min-height: 297mm;
            padding: 20mm;
            margin: 10px auto;
            box-sizing: border-box;
            position: relative;
            background-color: #ffffff;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          
          .font-outfit {
            font-family: 'Outfit', sans-serif;
          }
          
          .brand-logo {
            width: 38px;
            height: 38px;
            background-color: #4f46e5;
            color: white;
            font-size: 20px;
            font-weight: 800;
            font-style: italic;
            text-align: center;
            line-height: 38px;
            border-radius: 8px;
            display: inline-block;
          }
          
          .info-card {
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 16px;
            background-color: #f8fafc;
            width: 48%;
            box-sizing: border-box;
          }
          
          .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
          }
          
          .items-table th {
            border-bottom: 2px solid #0f172a;
            color: #475569;
            font-weight: 700;
            text-transform: uppercase;
            font-size: 9px;
            letter-spacing: 0.05em;
            padding: 8px;
            text-align: left;
          }
          
          .item-row {
            border-bottom: 1px solid #f1f5f9;
          }
          
          .totals-container {
            border-top: 2px double #0f172a;
            padding-top: 15px;
            margin-top: 20px;
            display: flex;
            justify-content: space-between;
          }
          
          .totals-table {
            width: 280px;
            border-collapse: collapse;
          }
          
          .totals-table td {
            padding: 5px 0;
            font-size: 11px;
          }
          
          .totals-label {
            font-weight: 600;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }
          
          .totals-val {
            text-align: right;
            font-weight: 700;
            font-family: monospace;
            color: #0f172a;
          }
          
          .grand-total-row td {
            padding-top: 10px;
            border-top: 1px solid #e2e8f0;
          }
          
          .grand-total-label {
            font-weight: 800;
            color: #4f46e5;
            font-size: 11px;
          }
          
          .grand-total-val {
            font-size: 16px;
            font-weight: 900;
            color: #0f172a;
          }
          
          .footer-section {
            border-top: 1px solid #f1f5f9;
            padding-top: 12px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 8px;
            color: #94a3b8;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }

          @media print {
            body {
              background-color: #ffffff;
              margin: 0;
            }
            .page {
              margin: 0;
              box-shadow: none;
              width: 210mm;
              min-height: 297mm;
            }
          }
        </style>
      </head>
      <body>
        <div class="page">
          <div style="flex: 1; display: flex; flex-direction: column;">
            
            <!-- Document Header -->
            <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #f1f5f9; padding-bottom: 18px; margin-bottom: 18px;">
              <div>
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
                  <img src="${companySettings?.logoUrl || '/maleehouse Logo.png'}" alt="Malee House Logo" style="height: 48px; width: auto; object-fit: contain;" />
                </div>
                
                <div style="font-size: 10px; color: #64748b; line-height: 1.5; font-weight: 500;">
                  <strong style="color: #334155;">${companySettings?.name || 'Malee House Head Office'}</strong><br/>
                  ${companySettings?.address || '4th Floor, Alpha Block, Sigma Tech Park'}<br/>
                  ${companySettings?.cityStateZip || 'Whitefield, Bangalore, Karnataka 560066'}<br/>
                  <span style="font-weight: 600; color: #4f46e5;">GSTIN: ${companySettings?.gstin?.toUpperCase() || '36AAAAA1111A1Z1'} | Tel: ${companySettings?.telephone || '+91 80 4987 6543'}</span>
                </div>
              </div>
              
              <div style="text-align: right;">
                <h1 class="font-outfit" style="font-size: 26px; font-weight: 900; color: #e2e8f0; text-transform: uppercase; margin: 0 0 10px 0; letter-spacing: -0.03em;">
                  ${amountPaid > 0 ? 'Tax Invoice' : 'Proforma Invoice'}
                </h1>
                
                <table style="border-collapse: collapse; margin-left: auto;">
                  <tr>
                    <td style="font-size: 8px; font-weight: 700; color: #94a3b8; text-transform: uppercase; text-align: right; padding-right: 8px; padding-bottom: 2px;">Invoice Number</td>
                    <td style="font-size: 11px; font-weight: 700; color: #0f172a; text-align: right; padding-bottom: 2px; font-family: monospace;">#${invoice.invoice_number}</td>
                  </tr>
                  <tr>
                    <td style="font-size: 8px; font-weight: 700; color: #94a3b8; text-transform: uppercase; text-align: right; padding-right: 8px; padding-bottom: 2px;">Date Issued</td>
                    <td style="font-size: 10px; font-weight: 600; color: #334155; text-align: right; padding-bottom: 2px;">${formatDate(issueDate)}</td>
                  </tr>
                  <tr>
                    <td style="font-size: 8px; font-weight: 700; color: #94a3b8; text-transform: uppercase; text-align: right; padding-right: 8px;">Due Date</td>
                    <td style="font-size: 10px; font-weight: 600; color: #ef4444; text-align: right;">${dueDate ? formatDate(dueDate) : 'Upon Receipt'}</td>
                  </tr>
                </table>
              </div>
            </div>
            
            <!-- Info Cards Row -->
            <div style="display: flex; justify-content: space-between; margin-bottom: 18px;">
              <div class="info-card">
                <div style="font-size: 8px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Client Bill To:</div>
                <div style="font-size: 12px; font-weight: 700; color: #0f172a; line-height: 1.2;">${project?.client_name || 'Client Name'}</div>
                ${project?.gst_number ? `<div style="font-size: 9.5px; color: #64748b; margin-top: 3px; font-weight: 600;">GSTIN: ${project.gst_number}</div>` : ''}
                <div style="font-size: 10px; color: #64748b; margin-top: 3px; font-weight: 500;">${project?.client_contact || 'Authorized project engagement'}</div>
              </div>
              <div class="info-card">
                <div style="font-size: 8px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Project Assignment:</div>
                <div style="font-size: 12px; font-weight: 700; color: #0f172a; line-height: 1.2;">${project?.name || 'Project Name'}</div>
                <div style="font-size: 10px; color: #64748b; margin-top: 3px; font-weight: 500;">Location: ${project?.site_details?.address || 'Site Technical Survey'}</div>
              </div>
            </div>
            
            <!-- Services Table -->
            <table class="items-table">
              <thead>
                <tr>
                  <th style="width: 30px;">#</th>
                  <th>Service Description</th>
                  <th style="width: 50px; text-align: center;">Qty</th>
                  <th style="width: 120px; text-align: right;">Unit Price</th>
                  <th style="width: 120px; text-align: right;">Total</th>
                </tr>
              </thead>
              <tbody>
                <tr class="item-row">
                  <td style="font-weight: 600; color: #94a3b8; padding: 12px 8px; font-size: 11px;">1</td>
                  <td style="padding: 12px 8px;">
                    <div style="font-weight: 700; color: #0f172a; text-transform: uppercase; font-size: 11px; letter-spacing: -0.01em;">
                      ${invoice.visit_id ? 'Field Visit Services' : 'Professional Services'}
                    </div>
                    <div style="color: #64748b; font-size: 10px; margin-top: 3px; line-height: 1.4;">
                      ${invoice.visit_id ? 'Scheduled from Milestones Portal' : 'As per project milestone agreement.'}
                    </div>
                  </td>
                  <td style="text-align: center; font-weight: 600; color: #0f172a; padding: 12px 8px; font-size: 11px;">1</td>
                  <td style="text-align: right; font-weight: 600; font-family: monospace; color: #334155; padding: 12px 8px; font-size: 11px;">INR ${Number(invoice.amount).toLocaleString('en-IN')}</td>
                  <td style="text-align: right; font-weight: 700; font-family: monospace; color: #0f172a; padding: 12px 8px; font-size: 11px;">INR ${Number(invoice.amount).toLocaleString('en-IN')}</td>
                </tr>
              </tbody>
            </table>
            
          </div>
          
          <!-- Totals and Bank Details -->
          <div style="margin-top: 15px;">
            <div class="totals-container">
              
              <div style="width: 48%; box-sizing: border-box;">
                <div style="font-size: 9px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px;">Payment Information</div>
                ${bankDetails ? `
                <table style="width: 100%; font-size: 9px; color: #475569; border: 1px solid #e2e8f0; background-color: #f8fafc; border-radius: 8px; padding: 8px;">
                  <tr>
                    <td style="width: 100px; font-weight: 600; padding: 4px;">Bank:</td>
                    <td style="padding: 4px; font-weight: 700; color: #0f172a;">${bankDetails.bank_name}</td>
                  </tr>
                  <tr>
                    <td style="font-weight: 600; padding: 4px;">Account Name:</td>
                    <td style="padding: 4px; font-weight: 700; color: #0f172a;">${bankDetails.account_name}</td>
                  </tr>
                  <tr>
                    <td style="font-weight: 600; padding: 4px;">Account Number:</td>
                    <td style="padding: 4px; font-family: monospace; font-weight: 700; color: #0f172a;">${bankDetails.account_number}</td>
                  </tr>
                  <tr>
                    <td style="font-weight: 600; padding: 4px;">IFSC Code:</td>
                    <td style="padding: 4px; font-family: monospace; font-weight: 700; color: #0f172a;">${bankDetails.ifsc_code}</td>
                  </tr>
                  <tr>
                    <td style="font-weight: 600; padding: 4px;">Branch:</td>
                    <td style="padding: 4px; font-weight: 700; color: #0f172a;">${bankDetails.branch_name}</td>
                  </tr>
                </table>
                ` : `
                <div style="border: 1px solid #fcd34d; background-color: #fffbeb; color: #b45309; padding: 12px; border-radius: 8px; font-size: 10px; font-weight: 600; text-align: center;">
                  No bank account selected for this invoice.
                </div>
                `}
              </div>
              
              <div style="width: 48%; display: flex; justify-content: flex-end;">
                <table class="totals-table">
                  <tr>
                    <td class="totals-label">Subtotal</td>
                    <td class="totals-val">INR ${Number(invoice.amount).toLocaleString('en-IN')}</td>
                  </tr>
                  ${(!gstType || gstType === 'CGST_SGST') && Number(invoice.gst_amount) > 0 ? `
                    <tr>
                      <td class="totals-label">CGST (${gstRate / 2}%)</td>
                      <td class="totals-val">INR ${(Number(invoice.gst_amount) / 2).toLocaleString('en-IN')}</td>
                    </tr>
                    <tr>
                      <td class="totals-label">SGST (${gstRate / 2}%)</td>
                      <td class="totals-val">INR ${(Number(invoice.gst_amount) / 2).toLocaleString('en-IN')}</td>
                    </tr>
                  ` : gstType === 'IGST' && Number(invoice.gst_amount) > 0 ? `
                    <tr>
                      <td class="totals-label">IGST (${gstRate}%)</td>
                      <td class="totals-val">INR ${Number(invoice.gst_amount).toLocaleString('en-IN')}</td>
                    </tr>
                  ` : ''}
                  <tr class="grand-total-row">
                    <td class="totals-label grand-total-label">Grand Total</td>
                    <td class="totals-val grand-total-val">INR ${Number(invoice.total_amount).toLocaleString('en-IN')}</td>
                  </tr>
                  <tr>
                    <td class="totals-label" style="padding-top: 8px;">Amount Paid</td>
                    <td class="totals-val" style="padding-top: 8px;">INR ${amountPaid.toLocaleString('en-IN')}</td>
                  </tr>
                  <tr>
                    <td class="totals-label" style="color: ${remainingAmount > 0 ? '#ef4444' : '#10b981'}; font-weight: 800;">Invoice Balance</td>
                    <td class="totals-val" style="color: ${remainingAmount > 0 ? '#ef4444' : '#10b981'}; font-weight: 800;">INR ${remainingAmount.toLocaleString('en-IN')}</td>
                  </tr>
                </table>
              </div>
            </div>
            
            <div class="footer-section" style="margin-top: 25px;">
              <span>Malee House Document Reference: #${invoice.invoice_number}</span>
              <span>Page 1 of 1</span>
            </div>
          </div>
        </div>
        
        <script>
          function doPrint() {
            window.focus();
            window.print();
          }
          if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(function() {
              setTimeout(doPrint, 400);
            });
          } else {
            window.onload = function() {
              setTimeout(doPrint, 600);
            };
          }
        </script>
      </body>
    </html>
  `;
  
  printWindow.document.open();
  printWindow.document.write(htmlContent);
  printWindow.document.close();
};

