import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    
    // Auth check using standard client
    const supabaseUser: any = await createClient();
    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized", data: null }, { status: 401 });
    }
    
    const { data: profile } = await supabaseUser.from('profiles').select('*').eq('id', user.id).single() as { data: any };
    if (!profile) {
      return NextResponse.json({ success: false, error: "Unauthorized", data: null }, { status: 401 });
    }

    const allowed = ["admin", "accountant", "engineer", "developer"];
    if (!allowed.includes((profile as any).role)) {
      return NextResponse.json({ success: false, error: "Unauthorized role for print operations", data: null }, { status: 403 });
    }

    // Input validation
    if (!payload.client_name?.trim()) {
      return NextResponse.json({ success: false, error: "Client name is required", data: null }, { status: 400 });
    }
    if (payload.copies < 1) {
      return NextResponse.json({ success: false, error: "Copies must be > 0", data: null }, { status: 400 });
    }
    if (payload.amount < 0) {
      return NextResponse.json({ success: false, error: "Amount cannot be negative", data: null }, { status: 400 });
    }

    const adminDb: any = createAdminClient();
    
    // Generate IDs
    const date = new Date();
    const yyyymmdd = [
      date.getFullYear(),
      (date.getMonth() + 1).toString().padStart(2, '0'),
      date.getDate().toString().padStart(2, '0')
    ].join('');
    const randomSuffix = Math.random().toString(36).substring(2, 6);
    const jobId = `PRT-${yyyymmdd}-${randomSuffix}`;
    
    const newJob = {
      id: jobId,
      client_name: payload.client_name,
      client_phone: payload.client_phone || null,
      project_id: payload.project_id || null,
      doc_type: payload.doc_type || null,
      file_name: payload.file_name || null,
      copies: payload.copies,
      paper_size: payload.paper_size,
      print_type: payload.print_type,
      amount: payload.amount,
      notes: payload.notes || null,
      status: 'draft',
      created_by: (profile as any).id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Insert Print Job
    const { error: insertError } = await adminDb.from('print_jobs').insert(newJob);
    if (insertError) {
      return NextResponse.json({ success: false, error: insertError.message, data: null }, { status: 500 });
    }

    let returnData: any = {
      id: jobId,
      client_name: newJob.client_name,
      amount: newJob.amount,
      status: newJob.status,
      payment_id: null,
      receipt_number: null
    };

    if (payload.amount > 0) {
      // Ensure generic walk-in project exists
      const { data: existingDesk } = await adminDb.from('projects').select('id').eq('id', 'PRJ-PRINT-DESK').single();
      if (!existingDesk) {
        await adminDb.from('projects').insert({
          id: 'PRJ-PRINT-DESK',
          name: 'Walk-in Print Jobs (Generic)',
          client_name: 'Walk-in',
          status: 'project_created',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }

      const paymentId = `pay-${Date.now()}-${randomSuffix}`;
      const isVerified = ['admin', 'accountant', 'developer'].includes(profile.role);
      const paymentStatus = isVerified ? 'verified' : 'pending';
      
      const { error: payError } = await adminDb.from('payments').insert({
        id: paymentId,
        project_id: 'PRJ-PRINT-DESK',
        amount: payload.amount,
        payment_method: 'cash',
        transaction_id: null,
        bank_id: null,
        payment_date: new Date().toISOString(),
        status: paymentStatus,
        verified_by: isVerified ? profile.id : null,
        verified_at: isVerified ? new Date().toISOString() : null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      
      if (payError) {
        // Rollback job
        await adminDb.from('print_jobs').delete().eq('id', jobId);
        return NextResponse.json({ success: false, error: payError.message, data: null }, { status: 500 });
      }

      if (isVerified) {
        await adminDb.from('activity_logs').insert({
          id: `act-${Date.now()}-${randomSuffix}`,
          project_id: 'PRJ-PRINT-DESK',
          action: 'RECEIPT_GENERATED',
          details: { amount: payload.amount, comment: "Payment verified. Receipt generated." },
          user_id: profile.id,
          created_at: new Date().toISOString()
        });
      }

      const receiptNumber = isVerified ? `REC-${paymentId.split('-').pop()}` : null;
      const jobStatus = isVerified ? 'paid' : 'draft';

      const { data: updatedJob, error: updateError } = await adminDb
        .from('print_jobs')
        .update({
          payment_id: paymentId,
          status: jobStatus,
          receipt_number: receiptNumber,
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId)
        .select()
        .single();
        
      if (updateError) {
        return NextResponse.json({ success: false, error: updateError.message, data: null }, { status: 500 });
      }

      returnData = {
        id: updatedJob.id,
        client_name: updatedJob.client_name,
        amount: updatedJob.amount,
        status: updatedJob.status,
        payment_id: updatedJob.payment_id,
        receipt_number: updatedJob.receipt_number
      };
    }

    try {
      await adminDb.from('activity_logs').insert({
        id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        project_id: payload.project_id || null,
        user_id: profile.id,
        action: 'PRINT_JOB_CREATED',
        details: { job_id: jobId, client: payload.client_name, amount: payload.amount },
        created_at: new Date().toISOString()
      });
    } catch (_) {}

    return NextResponse.json({ success: true, error: null, data: returnData }, { status: 200 });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg, data: null }, { status: 500 });
  }
}
