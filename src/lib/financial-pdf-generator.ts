import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';

export const generateFinancialReportPDF = (
  reportData: any,
  generatedConfig: {
    type: 'profit_loss' | 'income' | 'expense' | 'cash_flow' | 'balance_sheet' | 'project_statement',
    from: Date | string,
    to: Date | string,
    projectId?: string
  },
  companySettings: any,
  project: any,
  title: string
) => {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Please allow popups to preview/print the report.");
    return;
  }

  const issueDate = new Date();
  
  let periodText = '';
  if (generatedConfig.type === 'balance_sheet') {
    periodText = `As of: ${format(new Date(generatedConfig.to), 'MMM d, yyyy')}`;
  } else {
    periodText = `Period: ${format(new Date(generatedConfig.from), 'MMM d, yyyy')} to ${format(new Date(generatedConfig.to), 'MMM d, yyyy')}`;
  }

  let reportContentHtml = '';

  const generateTable = (headers: string[], rows: string[][], totals?: {label: string, value: string}[]) => {
    let html = `
      <table class="items-table">
        <thead>
          <tr>
            ${headers.map((h, i) => `<th style="text-align: ${i === headers.length - 1 ? 'right' : 'left'}">${h}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
    `;
    
    rows.forEach(row => {
      html += `<tr class="item-row">`;
      row.forEach((cell, i) => {
        html += `<td style="padding: 12px 8px; font-size: 11px; color: #0f172a; text-align: ${i === row.length - 1 ? 'right' : 'left'}">${cell}</td>`;
      });
      html += `</tr>`;
    });

    html += `</tbody></table>`;
    
    if (totals && totals.length > 0) {
      html += `
        <div class="totals-container">
          <table class="totals-table">
            ${totals.map((t, i) => `
              <tr ${i === totals.length - 1 ? 'class="grand-total-row"' : ''}>
                <td class="totals-label ${i === totals.length - 1 ? 'grand-total-label' : ''}">${t.label}</td>
                <td class="totals-val ${i === totals.length - 1 ? 'grand-total-val' : ''}">${t.value}</td>
              </tr>
            `).join('')}
          </table>
        </div>
      `;
    }
    
    return html;
  };

  if (generatedConfig.type === 'profit_loss' || generatedConfig.type === 'cash_flow') {
    const revRows = Object.entries(reportData.revenueByProject || {}).map(([k, v]) => [k, formatCurrency(v as number)]);
    const costRows = Object.entries(reportData.costsByCategory || {}).map(([k, v]) => [k, formatCurrency(v as number)]);
    
    reportContentHtml += `
      <div style="margin-bottom: 20px;">
        <h3 class="font-outfit" style="font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; margin-bottom: 8px;">Revenue by Project</h3>
        ${generateTable(['Project', 'Amount'], revRows, [{label: 'Total Revenue', value: formatCurrency(reportData.totalRevenue)}])}
      </div>
      <div style="margin-bottom: 20px;">
        <h3 class="font-outfit" style="font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; margin-bottom: 8px;">Costs by Category</h3>
        ${generateTable(['Category', 'Amount'], costRows, [{label: 'Total Costs', value: formatCurrency(reportData.totalCosts)}])}
      </div>
      <div class="totals-container" style="border-top: none; padding-top: 0;">
          <table class="totals-table">
              <tr class="grand-total-row">
                  <td class="totals-label grand-total-label">Net Profit</td>
                  <td class="totals-val grand-total-val" style="color: ${reportData.netProfit >= 0 ? '#10b981' : '#ef4444'}">${formatCurrency(reportData.netProfit)}</td>
              </tr>
          </table>
      </div>
    `;
  } else if (generatedConfig.type === 'income') {
    const rows = (reportData.incomeTransactions || []).map((t: any) => [
      new Date(t.date).toLocaleDateString(),
      t.project,
      formatCurrency(t.amount)
    ]);
    reportContentHtml += generateTable(['Date', 'Project', 'Amount'], rows, [{label: 'Total Income', value: formatCurrency(reportData.totalIncome)}]);
  } else if (generatedConfig.type === 'expense') {
    const rows = Object.entries(reportData.expensesByCategory || {}).map(([k, v]) => [k, formatCurrency(v as number)]);
    reportContentHtml += generateTable(['Category', 'Amount'], rows, [{label: 'Total Expenses', value: formatCurrency(reportData.totalExpenses)}]);
  } else if (generatedConfig.type === 'balance_sheet') {
    const assetRows = Object.entries(reportData.assets || {}).map(([k, v]) => [k, formatCurrency(v as number)]);
    const liabRows = Object.entries(reportData.liabilities || {}).map(([k, v]) => [k, formatCurrency(v as number)]);
    
    reportContentHtml += `
      <div style="margin-bottom: 20px;">
        <h3 class="font-outfit" style="font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; margin-bottom: 8px;">Assets</h3>
        ${generateTable(['Asset', 'Amount'], assetRows, [{label: 'Total Assets', value: formatCurrency(reportData.totalAssets)}])}
      </div>
      <div style="margin-bottom: 20px;">
        <h3 class="font-outfit" style="font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; margin-bottom: 8px;">Liabilities</h3>
        ${generateTable(['Liability', 'Amount'], liabRows, [{label: 'Total Liabilities', value: formatCurrency(reportData.totalLiabilities)}])}
      </div>
      <div class="totals-container" style="border-top: none; padding-top: 0;">
          <table class="totals-table">
              <tr class="grand-total-row">
                  <td class="totals-label grand-total-label">Total Equity</td>
                  <td class="totals-val grand-total-val">${formatCurrency(reportData.equity)}</td>
              </tr>
          </table>
      </div>
    `;
  } else if (generatedConfig.type === 'project_statement') {
    const rows = (reportData.timeline || []).map((t: any) => [
      t.title,
      t.due_date ? new Date(t.due_date).toLocaleDateString() : 'N/A',
      t.status.toUpperCase(),
      formatCurrency(t.total_amount)
    ]);
    
    reportContentHtml += `
      <h3 class="font-outfit" style="font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; margin-bottom: 8px;">Payment Timeline</h3>
      ${generateTable(['Milestone', 'Due Date', 'Status', 'Total'], rows, [
        {label: 'Total Billed', value: formatCurrency(reportData.summary?.totalBilled || 0)},
        {label: 'Total Paid', value: formatCurrency(reportData.summary?.totalPaid || 0)},
        {label: 'Outstanding', value: formatCurrency(reportData.summary?.outstanding || 0)}
      ])}
    `;
  } else if (generatedConfig.type === 'all_project_summary') {
    const rows = (reportData.projects || []).map((p: any, i: number) => `
      <tr>
        <td style="border: 1px solid black; padding: 4px;">${i + 1}</td>
        <td style="border: 1px solid black; padding: 4px;">${p.projectId || ''}</td>
        <td style="border: 1px solid black; padding: 4px;">${p.projectNo || ''}</td>
        <td style="border: 1px solid black; padding: 4px;">${p.projectName || ''}</td>
        <td style="border: 1px solid black; padding: 4px;">${p.contactNo || ''}</td>
        <td style="border: 1px solid black; padding: 4px;">${p.serviceType || ''}</td>
        <td style="border: 1px solid black; padding: 4px;">${p.location || ''}</td>
        <td style="border: 1px solid black; padding: 4px;">${p.totalInvoiceValue || ''}</td>
        <td style="border: 1px solid black; padding: 4px;">${p.budgetExpences || ''}</td>
        <td style="border: 1px solid black; padding: 4px;">${p.totalExpences || ''}</td>
        <td style="border: 1px solid black; padding: 4px;">${p.totalReceived || ''}</td>
        <td style="border: 1px solid black; padding: 4px;">${p.totalPending || ''}</td>
        <td style="border: 1px solid black; padding: 4px;">${p.totalProfitLoss || ''}</td>
      </tr>
    `).join('');

    reportContentHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: sans-serif; font-size: 11px; margin: 20px; color: black; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; border: 1px solid black; }
            th, td { border: 1px solid black; padding: 4px; text-align: left; }
            th { font-weight: bold; }
          </style>
        </head>
        <body>
          <table>
            <tr>
              <td colspan="13" style="font-weight: bold;">
                Company Name-${companySettings?.name || 'Company Name'}<br/>
                Address-${companySettings?.address || ''}${companySettings?.cityStateZip ? `, ${companySettings.cityStateZip}` : ''}<br/>
                GST NO-${companySettings?.gstin || 'GST Not Provided'}<br/>
                Contact No-${companySettings?.telephone || ''}${companySettings?.mobile ? ` / ${companySettings.mobile}` : ''}
              </td>
            </tr>
            <tr>
              <td colspan="13" style="font-weight: bold;">
                Select Date Range<br/>
                ${format(new Date(generatedConfig.from), 'dd/MM/yyyy')} to ${format(new Date(generatedConfig.to), 'dd/MM/yyyy')}
              </td>
            </tr>
            <tr>
              <th>SR NO</th>
              <th>Project ID</th>
              <th>Project Code</th>
              <th>Project/Client Name</th>
              <th>Contact No</th>
              <th>Service Type</th>
              <th>Location</th>
              <th>Total Invoice Value</th>
              <th>Budget Expences</th>
              <th>Total Expences</th>
              <th>Total Recived</th>
              <th>Total Pending</th>
              <th>Total Profit/Loss</th>
            </tr>
            ${rows || `<tr><td colspan="13" style="text-align:center;">No records found</td></tr>`}
          </table>
          <script>window.onload = function() { setTimeout(() => { window.print(); }, 500); };</script>
        </body>
      </html>
    `;
    printWindow.document.open();
    printWindow.document.write(reportContentHtml);
    printWindow.document.close();
    return;
  } else if (generatedConfig.type === 'project_budget_sheet') {
    let sectionsHtml = '';
    const budgetSections = ['Survey Costing', 'Planning Costing', 'Designing Costing', 'Submission Costing', 'Office Works'];
    budgetSections.forEach(section => {
      const rows = (reportData.budgetDetails?.[section] || []).map((item: any, i: number) => `
        <tr>
          <td>${i + 1}</td>
          <td>${item.particulars}</td>
          <td>${item.qty || 1}</td>
          <td>${item.rate || 0}</td>
          <td>${item.days || 1}</td>
          <td>${item.amount || 0}</td>
        </tr>
      `).join('');
      
      sectionsHtml += `
        <div style="font-weight: bold; text-decoration: underline; margin-top: 10px; margin-bottom: 5px;">${section}</div>
        <table>
          <tr><th>Sr No</th><th>Particulars</th><th>Qty</th><th>Rate</th><th>Days</th><th>Amount</th></tr>
          ${rows || `<tr><td>1</td><td></td><td></td><td></td><td></td><td></td></tr>`}
          <tr>
            <td colspan="5" style="text-align: right; font-weight: bold;">Total ${section}</td>
            <td style="font-weight: bold;">${reportData.sectionTotals?.[section] || 0}</td>
          </tr>
        </table>
      `;
    });

    reportContentHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: sans-serif; font-size: 11px; margin: 40px; color: black; max-width: 800px; margin-left: auto; margin-right: auto;}
            table { width: 100%; border-collapse: collapse; border: 1px solid black; }
            th, td { border: 1px solid black; padding: 4px; text-align: left; }
            .details-box { border: 1px solid black; padding: 10px; margin-bottom: 20px; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="details-box">
            Project Details<br/>
            - Project Name: ${project?.name || 'ABC'}<br/>
            - Client Name: ${project?.client_name || 'ABC'}<br/>
            - Location: ${project?.client_address || 'Koregaon'}<br/>
            - Service Type: Plot Measurement<br/>
            - Survey Duration: 2 Days<br/>
            - Project Amount: ₹ ${project?.budget || 8000}
          </div>
          ${sectionsHtml}
          <table>
            <tr><td colspan="5" style="text-align: right; font-weight: bold;">Total Project Value</td><td style="font-weight: bold;">${reportData.totalQuotationValue || 0}</td></tr>
            <tr><td colspan="5" style="text-align: right; font-weight: bold;">Total Project Costing</td><td style="font-weight: bold;">${reportData.totalProjectCosting || 0}</td></tr>
            <tr><td colspan="5" style="text-align: right; font-weight: bold;">Net Amount</td><td style="font-weight: bold;">${reportData.netAmount || 0}</td></tr>
          </table>
          <script>window.onload = function() { setTimeout(() => { window.print(); }, 500); };</script>
        </body>
      </html>
    `;
    printWindow.document.open();
    printWindow.document.write(reportContentHtml);
    printWindow.document.close();
    return;
  } else if (generatedConfig.type === 'expenses_fund_allocation') {
    const rows = (reportData.fundAllocations || []).map((item: any) => `
      <tr>
        <td>${item.bankName}</td>
        <td>${item.serviceDivide}</td>
        <td>${item.day || 1}</td>
        <td>${item.amount || 0}</td>
        <td>${item.remark || ''}</td>
      </tr>
    `).join('');

    reportContentHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: sans-serif; font-size: 12px; margin: 40px; color: black; text-align: center; }
            table { width: 100%; max-width: 800px; margin: 0 auto; border-collapse: collapse; border: 1px solid black; text-align: left; }
            th, td { border: 1px solid black; padding: 6px; }
            th { text-align: center; font-weight: bold; }
          </style>
        </head>
        <body>
          <table>
            <tr>
              <th colspan="5">Total Expences Fund Allocation</th>
            </tr>
            <tr>
              <th>Bank Name</th>
              <th>Service Devide</th>
              <th>Day</th>
              <th>Amount</th>
              <th>Remark</th>
            </tr>
            ${rows || `
              <tr>
                <td rowspan="7">Union Bank</td>
                <td>Survey Engineer Salary</td><td>1</td><td>700</td><td>Freeze</td>
              </tr>
              <tr><td>Driver Salary</td><td>1</td><td>1000</td><td>Freeze</td></tr>
              <tr><td>Helper Salary</td><td>1</td><td>700</td><td>Freeze</td></tr>
              <tr><td>Designer Payment</td><td></td><td></td><td>Unfreeze</td></tr>
              <tr><td>Accountant</td><td>1</td><td>200</td><td>Freeze</td></tr>
              <tr><td>H.R</td><td>1</td><td>100</td><td>Freeze</td></tr>
              <tr><td>Sales</td><td>1</td><td>200</td><td>Freeze</td></tr>
              
              <tr>
                <td rowspan="8">HDFC</td>
                <td>Travelling (Petrol) (Per 50Km)</td><td>1</td><td>50</td><td>Unfreeze</td>
              </tr>
              <tr><td>Accomodation</td><td>1</td><td>800</td><td>Unfreeze</td></tr>
              <tr><td>Food & Breakfast</td><td>1</td><td>200</td><td>Unfreeze</td></tr>
              <tr><td>Vehicle Maintance</td><td>1</td><td>300</td><td>Unfreeze</td></tr>
              <tr><td>Paint</td><td>1</td><td>50</td><td>Unfreeze</td></tr>
              <tr><td>Fakki</td><td>1</td><td>50</td><td>Unfreeze</td></tr>
              <tr><td>Other Field Expences</td><td>1</td><td>200</td><td>Freeze</td></tr>
              <tr><td>Submission Travel</td><td>1</td><td>20</td><td>Freeze</td></tr>

              <tr>
                <td rowspan="6">Karad Urben</td>
                <td>Equipment Rent (DGPS)</td><td>1</td><td>2000</td><td>Freeze</td>
              </tr>
              <tr><td>Equipment Rent (Drone)</td><td>1</td><td>5000</td><td>Freeze</td></tr>
              <tr><td>Data Processing Cost(DGPS)</td><td>1</td><td>500</td><td>Freeze</td></tr>
              <tr><td>Data Processing Cost(Drone)</td><td>1</td><td>2300</td><td>Freeze</td></tr>
              <tr><td>Computer Cost</td><td>1</td><td>100</td><td>Freeze</td></tr>
              <tr><td>Stationary</td><td>1</td><td>50</td><td>Unfreeze</td></tr>
              
              <tr>
                <td>Bank of Maharashtra</td>
                <td colspan="4" style="text-align: center; font-weight: bold;">Payment In</td>
              </tr>
            `}
          </table>
          <script>window.onload = function() { setTimeout(() => { window.print(); }, 500); };</script>
        </body>
      </html>
    `;
    printWindow.document.open();
    printWindow.document.write(reportContentHtml);
    printWindow.document.close();
    return;
  } else if (generatedConfig.type === 'project_actual_sheet') {
    const rows = (reportData.ledger || []).map((item: any) => `
      <tr>
        <td>${new Date(item.date).toLocaleDateString('en-GB').replace(/\//g, '-')}</td>
        <td>${item.particulars}</td>
        <td class="text-right">${item.debit || ''}</td>
        <td class="text-right">${item.credit || ''}</td>
      </tr>
    `).join('');

    reportContentHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=Inter:wght@400;500;600;700;800&display=swap');
            
            body { font-family: 'Inter', sans-serif; font-size: 11px; margin: 0; padding: 40px; color: #1e293b; background-color: #f8fafc; }
            .report-container { max-width: 800px; margin: 0 auto; background: white; padding: 40px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border-radius: 8px; }
            .header-title { font-family: 'Outfit', sans-serif; font-size: 24px; font-weight: 800; color: #0f172a; text-transform: uppercase; margin-bottom: 20px; text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 15px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border-bottom: 1px solid #e2e8f0; padding: 12px 16px; text-align: left; }
            th { font-family: 'Outfit', sans-serif; font-weight: 700; color: #475569; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em; background-color: #f8fafc; }
            .details-box { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
            .detail-item { margin-bottom: 8px; }
            .detail-label { font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px; }
            .detail-value { font-size: 12px; font-weight: 600; color: #0f172a; }
            .text-right { text-align: right; }
            .summary-row td { font-weight: 700; color: #0f172a; background-color: #f8fafc; }
            .grand-total td { font-size: 13px; font-weight: 800; color: #4f46e5; border-top: 2px solid #e2e8f0; }
            .totals-container { width: 100%; display: flex; justify-content: flex-end; margin-top: 20px; }
            .totals-table { width: 300px; margin-top: 0; }
            @media print {
              body { background-color: white; padding: 0; }
              .report-container { box-shadow: none; padding: 0; width: 100%; max-width: 100%; }
            }
          </style>
        </head>
        <body>
          <div class="report-container">
            <div class="header-title">${title}</div>
            <div class="details-box">
              <div>
                <div class="detail-item">
                  <div class="detail-label">Project Name</div>
                  <div class="detail-value">${project?.name || 'N/A'}</div>
                </div>
                <div class="detail-item">
                  <div class="detail-label">Client Name</div>
                  <div class="detail-value">${project?.client_name || 'N/A'}</div>
                </div>
                <div class="detail-item">
                  <div class="detail-label">Location</div>
                  <div class="detail-value">${project?.client_address || 'N/A'}</div>
                </div>
              </div>
              <div>
                <div class="detail-item">
                  <div class="detail-label">Service Type</div>
                  <div class="detail-value">${project?.service_type || 'N/A'}</div>
                </div>
                <div class="detail-item">
                  <div class="detail-label">Survey Duration</div>
                  <div class="detail-value">${project?.survey_duration || 'N/A'}</div>
                </div>
                <div class="detail-item">
                  <div class="detail-label">Commercial Budget</div>
                  <div class="detail-value">${project?.budget ? '₹ ' + project.budget : (project?.quotation_amount ? '₹ ' + project.quotation_amount : '₹ ' + (reportData.total || 0))}</div>
                </div>
              </div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Particulars</th>
                  <th class="text-right">Debit</th>
                  <th class="text-right">Credit</th>
                </tr>
              </thead>
              <tbody>
                ${rows || `
                  <tr>
                    <td colspan="4" style="text-align: center; color: #64748b; font-style: italic;">No ledger records found</td>
                  </tr>
                `}
              </tbody>
            </table>
            
            <div class="totals-container">
              <table class="totals-table">
                <tr class="summary-row">
                  <td>Net Profit/Loss</td>
                  <td class="text-right" style="color: ${Number(reportData.netProfitLoss || 0) >= 0 ? '#10b981' : '#ef4444'}">${reportData.netProfitLoss || 0}</td>
                </tr>
                <tr class="grand-total">
                  <td>Total</td>
                  <td class="text-right">${reportData.total || 0}</td>
                </tr>
              </table>
            </div>
          </div>
          <script>window.onload = function() { setTimeout(() => { window.print(); }, 500); };</script>
        </body>
      </html>
    `;
    printWindow.document.open();
    printWindow.document.write(reportContentHtml);
    printWindow.document.close();
    return;
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=Inter:wght@400;500;600;700;800&display=swap');
          
          @page { size: A4 portrait; margin: 0; }
          
          body {
            font-family: 'Inter', -apple-system, sans-serif;
            color: #1e293b;
            margin: 0; padding: 0;
            background-color: #f1f5f9;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          .page {
            width: 210mm; min-height: 297mm;
            padding: 20mm; margin: 10px auto;
            box-sizing: border-box; position: relative;
            background-color: #ffffff;
            box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
            display: flex; flex-direction: column;
            page-break-after: always;
          }
          
          .page:last-child { page-break-after: avoid; }
          .font-outfit { font-family: 'Outfit', sans-serif; }
          
          .brand-logo {
            width: 38px; height: 38px;
            background-color: #4f46e5; color: white;
            font-size: 20px; font-weight: 800; font-style: italic;
            text-align: center; line-height: 38px;
            border-radius: 8px; display: inline-block;
          }
          
          .info-card {
            border: 1px solid #e2e8f0; border-radius: 12px;
            padding: 16px; background-color: #f8fafc;
            width: 48%; box-sizing: border-box;
          }
          
          .items-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          .items-table th {
            border-bottom: 2px solid #0f172a; color: #475569; font-weight: 700;
            text-transform: uppercase; font-size: 9px; letter-spacing: 0.05em; padding: 8px;
          }
          .item-row { border-bottom: 1px solid #f1f5f9; }
          
          .totals-container { border-top: 2px double #0f172a; padding-top: 15px; margin-top: 20px; display: flex; justify-content: flex-end; }
          .totals-table { width: 280px; border-collapse: collapse; }
          .totals-table td { padding: 5px 0; font-size: 11px; }
          .totals-label { font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
          .totals-val { text-align: right; font-weight: 700; font-family: monospace; color: #0f172a; }
          
          .grand-total-row td { padding-top: 10px; border-top: 1px solid #e2e8f0; }
          .grand-total-label { font-weight: 800; color: #4f46e5; font-size: 11px; }
          .grand-total-val { font-size: 16px; font-weight: 900; color: #0f172a; }
          
          .footer-section {
            border-top: 1px solid #f1f5f9; padding-top: 12px; margin-top: auto;
            display: flex; justify-content: space-between; font-size: 8px;
            color: #94a3b8; font-weight: 600; text-transform: uppercase;
          }

          @media print {
            body { background-color: #ffffff; margin: 0; }
            .page { margin: 0; box-shadow: none; width: 210mm; height: 297mm; }
          }
        </style>
      </head>
      <body>
        <div class="page">
          <div style="flex: 1; display: flex; flex-direction: column;">
            
            <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #f1f5f9; padding-bottom: 18px; margin-bottom: 18px;">
              <div>
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
                  <img src="${companySettings?.logoUrl || '/maleehouse Logo.png'}" alt="Malee House Logo" style="height: 48px; width: auto; object-fit: contain;" />
                </div>
                
                <div style="font-size: 10px; color: #64748b; line-height: 1.5; font-weight: 500;">
                  <strong style="color: #334155;">${companySettings?.name || 'Malee House'}</strong><br/>
                  ${companySettings?.address || ''}<br/>
                  <span style="font-weight: 600; color: #4f46e5;">GSTIN: ${companySettings?.gstin || ''}</span>
                </div>
              </div>
              
              <div style="text-align: right;">
                <h1 class="font-outfit" style="font-size: 24px; font-weight: 900; color: #e2e8f0; text-transform: uppercase; margin: 0 0 10px 0; letter-spacing: -0.03em;">${title}</h1>
                
                <table style="border-collapse: collapse; margin-left: auto;">
                  <tr>
                    <td style="font-size: 8px; font-weight: 700; color: #94a3b8; text-transform: uppercase; text-align: right; padding-right: 8px; padding-bottom: 2px;">Report Date</td>
                    <td style="font-size: 10px; font-weight: 600; color: #334155; text-align: right; padding-bottom: 2px;">${issueDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</td>
                  </tr>
                  <tr>
                    <td style="font-size: 8px; font-weight: 700; color: #94a3b8; text-transform: uppercase; text-align: right; padding-right: 8px;">Period</td>
                    <td style="font-size: 10px; font-weight: 600; color: #ef4444; text-align: right;">${periodText}</td>
                  </tr>
                </table>
              </div>
            </div>
            
            <div style="display: flex; justify-content: space-between; margin-bottom: 18px;">
              <div class="info-card">
                <div style="font-size: 8px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Client Bill To:</div>
                <div style="font-size: 12px; font-weight: 700; color: #0f172a; line-height: 1.2;">${project?.client_name || (generatedConfig.projectId ? 'Client' : 'All Projects (Company-wide)')}</div>
                <div style="font-size: 10px; color: #64748b; margin-top: 3px; font-weight: 500;">${project?.client_address || (generatedConfig.projectId ? 'Address Not Provided' : 'N/A')}</div>
                <div style="font-size: 10px; color: #64748b; margin-top: 1px; font-weight: 500;">${project?.client_contact || (generatedConfig.projectId ? '' : 'N/A')}</div>
              </div>
              <div class="info-card">
                <div style="font-size: 8px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Report Details:</div>
                <div style="font-size: 12px; font-weight: 700; color: #0f172a; line-height: 1.2;">${title}</div>
                <div style="font-size: 10px; color: #64748b; margin-top: 3px; font-weight: 500;">Generated via Malee House OS</div>
              </div>
            </div>
            
            ${reportContentHtml}
            
          </div>
          <div class="footer-section">
            <span>Malee House Document Reference: Financial Report</span>
            <span>Page 1 of 1</span>
          </div>
        </div>
        <script>
          window.onload = function() {
            setTimeout(() => { window.print(); }, 500);
          };
        </script>
      </body>
    </html>
  `;
  
  printWindow.document.open();
  printWindow.document.write(htmlContent);
  printWindow.document.close();
};
