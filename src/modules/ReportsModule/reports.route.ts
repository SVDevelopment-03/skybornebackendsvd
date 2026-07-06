import { ReportsController } from "./reports.controller";

const _reportsController = new ReportsController();

export const ReportsRoute = [
  {
    path: "/reports/overview",
    request: null,
    action: _reportsController.getOverview,
    method: "get",
    roles: ["admin"],
  },
  {
    path: "/reports/export/csv",
    request: null,
    action: _reportsController.exportCsv,
    method: "get",
    roles: ["admin"],
  },
  {
    path: "/reports/credits",
    request: null,
    action: _reportsController.getCreditReport,
    method: "get",
    roles: ["admin"],
  },
  {
    path: "/reports/credits/export/csv",
    request: null,
    action: _reportsController.exportCreditCsv,
    method: "get",
    roles: ["admin"],
  },
];