import { DbConnection } from '@/module_bindings';
import * as GetAdminGuestPageProcedure from '@/module_bindings/get_admin_guest_page_procedure';
import * as GetAdminInviteCodesProcedure from '@/module_bindings/get_admin_invite_codes_procedure';
import * as GetAdminMessagePageProcedure from '@/module_bindings/get_admin_message_page_procedure';
import * as GetAdminDashboardSnapshotProcedure from '@/module_bindings/get_admin_dashboard_snapshot_procedure';
import * as GetGuestPortalStateProcedure from '@/module_bindings/get_guest_portal_state_procedure';
import * as GetGuestPreviewByInviteCodeProcedure from '@/module_bindings/get_guest_preview_by_invite_code_procedure';
import type {
  GetAdminGuestPageResult,
  GetAdminInviteCodesResult,
  GetAdminMessagePageResult,
  GetAdminDashboardSnapshotResult,
  GetGuestPortalStateResult,
  GetGuestPreviewByInviteCodeResult,
} from '@/module_bindings/types/procedures';

type ProcedureCaller = {
  callProcedureWithParams: (
    procedureName: string,
    paramsType: unknown,
    params: object,
    returnType: unknown
  ) => Promise<unknown>;
  procedures?: Record<string, (params: object) => Promise<unknown>>;
};

async function callProcedure<Result>(
  connection: DbConnection,
  procedureName: string,
  accessorName: string,
  paramsType: unknown,
  params: object,
  returnType: unknown
): Promise<Result> {
  const caller = connection as unknown as ProcedureCaller;
  const accessor = caller.procedures?.[accessorName];
  if (typeof accessor === 'function') {
    return accessor(params) as Promise<Result>;
  }

  return caller.callProcedureWithParams(
    procedureName,
    paramsType,
    params,
    returnType
  ) as Promise<Result>;
}

export function getAdminDashboardSnapshot(
  connection: DbConnection,
  params: { adminSecret: string }
): Promise<GetAdminDashboardSnapshotResult> {
  return callProcedure<GetAdminDashboardSnapshotResult>(
    connection,
    'get_admin_dashboard_snapshot',
    'getAdminDashboardSnapshot',
    GetAdminDashboardSnapshotProcedure.params,
    params,
    GetAdminDashboardSnapshotProcedure.returnType
  );
}

export function getAdminGuestPage(
  connection: DbConnection,
  params: {
    adminSecret: string;
    page: number;
    pageSize: number;
    search?: string;
    rsvpStatus?: string;
    hasDietary?: string;
    hasCompanions?: string;
    messageStatus?: string;
  }
): Promise<GetAdminGuestPageResult> {
  return callProcedure<GetAdminGuestPageResult>(
    connection,
    'get_admin_guest_page',
    'getAdminGuestPage',
    GetAdminGuestPageProcedure.params,
    params,
    GetAdminGuestPageProcedure.returnType
  );
}

export function getAdminMessagePage(
  connection: DbConnection,
  params: {
    adminSecret: string;
    page: number;
    pageSize: number;
    search?: string;
    status?: string;
  }
): Promise<GetAdminMessagePageResult> {
  return callProcedure<GetAdminMessagePageResult>(
    connection,
    'get_admin_message_page',
    'getAdminMessagePage',
    GetAdminMessagePageProcedure.params,
    params,
    GetAdminMessagePageProcedure.returnType
  );
}

export function getAdminInviteCodes(
  connection: DbConnection,
  params: { adminSecret: string }
): Promise<GetAdminInviteCodesResult> {
  return callProcedure<GetAdminInviteCodesResult>(
    connection,
    'get_admin_invite_codes',
    'getAdminInviteCodes',
    GetAdminInviteCodesProcedure.params,
    params,
    GetAdminInviteCodesProcedure.returnType
  );
}

export function getGuestPortalState(
  connection: DbConnection,
  params: { inviteCode?: string }
): Promise<GetGuestPortalStateResult> {
  return callProcedure<GetGuestPortalStateResult>(
    connection,
    'get_guest_portal_state',
    'getGuestPortalState',
    GetGuestPortalStateProcedure.params,
    params,
    GetGuestPortalStateProcedure.returnType
  );
}

export function getGuestPreviewByInviteCode(
  connection: DbConnection,
  params: { inviteCode: string }
): Promise<GetGuestPreviewByInviteCodeResult> {
  return callProcedure<GetGuestPreviewByInviteCodeResult>(
    connection,
    'get_guest_preview_by_invite_code',
    'getGuestPreviewByInviteCode',
    GetGuestPreviewByInviteCodeProcedure.params,
    params,
    GetGuestPreviewByInviteCodeProcedure.returnType
  );
}
