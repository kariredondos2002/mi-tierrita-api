import { Router } from "express";
import { authorize, Roles } from "../security/index";
import { inventoryReportController, receivablesReportController, salesReportController } from "../controllers/reports/index";
import { exportInventoryController, exportReceivablesController, exportSalesController, listExportsController } from "../controllers/exports/index";

export const reportsRouter = Router();
// Exportación PDF / Excel (v4.2): cada descarga queda en la auditoría con método EXPORT
reportsRouter.get("/exports", authorize(Roles.ADMIN, Roles.SALES), listExportsController);
reportsRouter.get("/sales/export", authorize(Roles.ADMIN, Roles.SALES), exportSalesController);
reportsRouter.get("/inventory/export", authorize(Roles.ADMIN), exportInventoryController);
reportsRouter.get("/receivables/export", authorize(Roles.ADMIN), exportReceivablesController);
reportsRouter.get("/sales", authorize(Roles.ADMIN, Roles.SALES), salesReportController);
reportsRouter.get("/inventory", authorize(Roles.ADMIN), inventoryReportController);
reportsRouter.get("/receivables", authorize(Roles.ADMIN), receivablesReportController);
