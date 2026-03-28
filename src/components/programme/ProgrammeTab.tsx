"use client";

import { useState } from "react";
import { ChevronRight, ChevronDown, ChevronLeft, Plus, X } from "lucide-react";

type NodeType = "scope" | "task" | "subtask" | "activity";

interface ProgrammeNode {
  id: string;
  activityId?: string;
  name: string;
  type: NodeType;
  totalHours: number | null;
  start: string;
  finish: string;
  forecastTotalHours: number | null;
  status: string;
  children: ProgrammeNode[];
}

const initialData: ProgrammeNode[] = [
  {
    id: "s9", name: "9. Bridge Scope - MVP", type: "scope",
    totalHours: 92, start: "06-Aug-25", finish: "15-Dec-25", forecastTotalHours: 92, status: "", children: [
      { id: "a3610", activityId: "A3610", name: "Ongoing MVP Options for the LU works", type: "activity", totalHours: 92, start: "06-Aug-25", finish: "15-Dec-25", forecastTotalHours: 92, status: "Completed", children: [] },
    ],
  },
  {
    id: "s10", name: "10. SSP (Spatial Scope Planning)", type: "scope",
    totalHours: 92, start: "16-Dec-25", finish: "27-Feb-26", forecastTotalHours: 92, status: "", children: [
      { id: "a3620", activityId: "A3620", name: "Ongoing support", type: "activity", totalHours: 92, start: "16-Dec-25", finish: "27-Feb-26", forecastTotalHours: 92, status: "In Progress", children: [] },
    ],
  },
  {
    id: "s11", name: "11. CGMM - Early Design Workstream", type: "scope",
    totalHours: 79, start: "25-Nov-25", finish: "13-Mar-26", forecastTotalHours: 79, status: "", children: [
      {
        id: "t11-1", name: "11.1 CGMM", type: "task",
        totalHours: 76, start: "25-Nov-25", finish: "10-Mar-26", forecastTotalHours: 76, status: "", children: [
          { id: "a3630", activityId: "A3630", name: "NR options/HS2 station development - get list", type: "activity", totalHours: 3, start: "25-Nov-25", finish: "27-Nov-25", forecastTotalHours: 3, status: "In Progress", children: [] },
          { id: "a3640", activityId: "A3640", name: "CGMM Development", type: "activity", totalHours: 10, start: "30-Dec-25", finish: "12-Jan-26", forecastTotalHours: 10, status: "In Progress", children: [] },
          { id: "a3650", activityId: "A3650", name: "Draft Report", type: "activity", totalHours: 10, start: "13-Jan-26", finish: "02-Feb-26", forecastTotalHours: 10, status: "In Progress", children: [] },
          { id: "a3660", activityId: "A3660", name: "Internal review", type: "activity", totalHours: 5, start: "03-Feb-26", finish: "09-Feb-26", forecastTotalHours: 5, status: "In Progress", children: [] },
          { id: "a3670", activityId: "A3670", name: "Issue draft to CP", type: "activity", totalHours: 2, start: "10-Feb-26", finish: "11-Feb-26", forecastTotalHours: 2, status: "In Progress", children: [] },
          { id: "a3680", activityId: "A3680", name: "CP Review", type: "activity", totalHours: 10, start: "12-Feb-26", finish: "25-Feb-26", forecastTotalHours: 10, status: "Not Started", children: [] },
          { id: "a3690", activityId: "A3690", name: "Presentation to NR", type: "activity", totalHours: 2, start: "26-Feb-26", finish: "27-Feb-26", forecastTotalHours: 2, status: "Not Started", children: [] },
          { id: "a3700", activityId: "A3700", name: "Update comments from NR and CP", type: "activity", totalHours: 5, start: "02-Mar-26", finish: "06-Mar-26", forecastTotalHours: 5, status: "Not Started", children: [] },
          { id: "a3710", activityId: "A3710", name: "Final Issue", type: "activity", totalHours: 2, start: "09-Mar-26", finish: "10-Mar-26", forecastTotalHours: 2, status: "Not Started", children: [] },
        ],
      },
      {
        id: "t11-2", name: "11.2 Mitigation", type: "task",
        totalHours: 45, start: "12-Jan-26", finish: "13-Mar-26", forecastTotalHours: 45, status: "", children: [
          { id: "a3720", activityId: "A3720", name: "Mitigation requirements critical assets", type: "activity", totalHours: 7, start: "12-Jan-26", finish: "20-Jan-26", forecastTotalHours: 7, status: "Not Started", children: [] },
          { id: "a3730", activityId: "A3730", name: "Draft Report", type: "activity", totalHours: 9, start: "21-Jan-26", finish: "02-Feb-26", forecastTotalHours: 9, status: "Not Started", children: [] },
          { id: "a3740", activityId: "A3740", name: "Internal review", type: "activity", totalHours: 5, start: "03-Feb-26", finish: "09-Feb-26", forecastTotalHours: 5, status: "Not Started", children: [] },
          { id: "a3750", activityId: "A3750", name: "Issue draft to CP", type: "activity", totalHours: 2, start: "10-Feb-26", finish: "11-Feb-26", forecastTotalHours: 2, status: "Not Started", children: [] },
          { id: "a3760", activityId: "A3760", name: "CP Review", type: "activity", totalHours: 10, start: "12-Feb-26", finish: "25-Feb-26", forecastTotalHours: 10, status: "Not Started", children: [] },
          { id: "a3770", activityId: "A3770", name: "Presentation to Critical assets", type: "activity", totalHours: 5, start: "26-Feb-26", finish: "04-Mar-26", forecastTotalHours: 5, status: "Not Started", children: [] },
          { id: "a3780", activityId: "A3780", name: "Update comments from NR and CP", type: "activity", totalHours: 5, start: "05-Mar-26", finish: "11-Mar-26", forecastTotalHours: 5, status: "Not Started", children: [] },
          { id: "a3790", activityId: "A3790", name: "Final Issue", type: "activity", totalHours: 2, start: "12-Mar-26", finish: "13-Mar-26", forecastTotalHours: 2, status: "Not Started", children: [] },
        ],
      },
    ],
  },
  {
    id: "s12", name: "12. NR Boiler Room-Feasibility Study", type: "scope",
    totalHours: 86, start: "17-Nov-25", finish: "16-Mar-26", forecastTotalHours: 86, status: "", children: [
      { id: "a3800", activityId: "A3800", name: "Review scope, identify elements impacted, develop methodology", type: "activity", totalHours: 10, start: "17-Nov-25", finish: "28-Nov-25", forecastTotalHours: 10, status: "Completed", children: [] },
      { id: "a3810", activityId: "A3810", name: "Assessment (Gantry crane & Silo foundations, Eversholt Street & Boiler room)", type: "activity", totalHours: 45, start: "01-Dec-25", finish: "30-Jan-26", forecastTotalHours: 45, status: "Completed", children: [] },
      { id: "a3820", activityId: "A3820", name: "Draft Report", type: "activity", totalHours: 10, start: "02-Feb-26", finish: "13-Feb-26", forecastTotalHours: 10, status: "Completed", children: [] },
      { id: "a3830", activityId: "A3830", name: "Internal review", type: "activity", totalHours: 2, start: "16-Feb-26", finish: "17-Feb-26", forecastTotalHours: 2, status: "Completed", children: [] },
      { id: "a3840", activityId: "A3840", name: "Issue draft to CP", type: "activity", totalHours: 2, start: "18-Feb-26", finish: "19-Feb-26", forecastTotalHours: 2, status: "Completed", children: [] },
      { id: "a3850", activityId: "A3850", name: "Presentation to Stakeholders (MDjv to confirm stakeholders) - TBC", type: "activity", totalHours: 2, start: "20-Feb-26", finish: "23-Feb-26", forecastTotalHours: 2, status: "Not Started", children: [] },
      { id: "a3860", activityId: "A3860", name: "CP Review", type: "activity", totalHours: 10, start: "20-Feb-26", finish: "05-Mar-26", forecastTotalHours: 10, status: "Not Started", children: [] },
      { id: "a3870", activityId: "A3870", name: "Update comments from CP and Stakeholders", type: "activity", totalHours: 5, start: "06-Mar-26", finish: "12-Mar-26", forecastTotalHours: 5, status: "Not Started", children: [] },
      { id: "a3880", activityId: "A3880", name: "Final Issue", type: "activity", totalHours: 2, start: "13-Mar-26", finish: "16-Mar-26", forecastTotalHours: 2, status: "Not Started", children: [] },
    ],
  },
  {
    id: "s13", name: "13. +17mOD and +13 mOD impact assessment excavation", type: "scope",
    totalHours: 76, start: "21-Jan-26", finish: "06-May-26", forecastTotalHours: 76, status: "", children: [
      { id: "a3890", activityId: "A3890", name: "Coordination with SDSC (ongoing)", type: "activity", totalHours: 55, start: "21-Jan-26", finish: "07-Apr-26", forecastTotalHours: 10, status: "Not Started", children: [] },
      {
        id: "t13-1", name: "13.1 +17mOD", type: "task",
        totalHours: 63, start: "22-Jan-26", finish: "20-Apr-26", forecastTotalHours: 63, status: "", children: [
          { id: "a3900", activityId: "A3900", name: "+17mOD impact assessment (old/new utilities, buildings)", type: "activity", totalHours: 30, start: "22-Jan-26", finish: "04-Mar-26", forecastTotalHours: 30, status: "In Progress", children: [] },
          { id: "a3910", activityId: "A3910", name: "Draft Report", type: "activity", totalHours: 10, start: "05-Mar-26", finish: "18-Mar-26", forecastTotalHours: 10, status: "Not Started", children: [] },
          { id: "a3920", activityId: "A3920", name: "Internal review", type: "activity", totalHours: 2, start: "19-Mar-26", finish: "20-Mar-26", forecastTotalHours: 2, status: "Not Started", children: [] },
          { id: "a3930", activityId: "A3930", name: "Issue draft to CP", type: "activity", totalHours: 2, start: "23-Mar-26", finish: "24-Mar-26", forecastTotalHours: 2, status: "Not Started", children: [] },
          { id: "a3940", activityId: "A3940", name: "CP Review", type: "activity", totalHours: 10, start: "25-Mar-26", finish: "07-Apr-26", forecastTotalHours: 10, status: "Not Started", children: [] },
          { id: "a3950", activityId: "A3950", name: "Presentation to Stakeholders", type: "activity", totalHours: 2, start: "08-Apr-26", finish: "09-Apr-26", forecastTotalHours: 2, status: "Not Started", children: [] },
          { id: "a3960", activityId: "A3960", name: "Update comments from CP and Stakeholders", type: "activity", totalHours: 5, start: "10-Apr-26", finish: "16-Apr-26", forecastTotalHours: 5, status: "Not Started", children: [] },
          { id: "a3970", activityId: "A3970", name: "Final Issue", type: "activity", totalHours: 2, start: "17-Apr-26", finish: "20-Apr-26", forecastTotalHours: 2, status: "Not Started", children: [] },
        ],
      },
      {
        id: "t13-2", name: "13.2 +13mOD", type: "task",
        totalHours: 73, start: "26-Jan-26", finish: "06-May-26", forecastTotalHours: 73, status: "", children: [
          { id: "a3980", activityId: "A3980", name: "+13mOD impact assessment (old/new utilities, buildings/LU)", type: "activity", totalHours: 50, start: "26-Jan-26", finish: "03-Apr-26", forecastTotalHours: 50, status: "In Progress", children: [] },
          { id: "a3990", activityId: "A3990", name: "Drawings Sketches for Report", type: "activity", totalHours: 40, start: "26-Jan-26", finish: "20-Mar-26", forecastTotalHours: 40, status: "Not Started", children: [] },
          { id: "a4000", activityId: "A4000", name: "Draft Reports (LU, TW, NR, Buildings)", type: "activity", totalHours: 10, start: "23-Mar-26", finish: "03-Apr-26", forecastTotalHours: 10, status: "Not Started", children: [] },
          { id: "a4010", activityId: "A4010", name: "Internal review", type: "activity", totalHours: 2, start: "06-Apr-26", finish: "07-Apr-26", forecastTotalHours: 2, status: "Not Started", children: [] },
          { id: "a4020", activityId: "A4020", name: "Issue draft to CP", type: "activity", totalHours: 2, start: "08-Apr-26", finish: "09-Apr-26", forecastTotalHours: 2, status: "Not Started", children: [] },
          { id: "a4030", activityId: "A4030", name: "CP Review", type: "activity", totalHours: 10, start: "10-Apr-26", finish: "23-Apr-26", forecastTotalHours: 10, status: "Not Started", children: [] },
          { id: "a4040", activityId: "A4040", name: "Presentation to Stakeholders", type: "activity", totalHours: 2, start: "24-Apr-26", finish: "27-Apr-26", forecastTotalHours: 2, status: "Not Started", children: [] },
          { id: "a4050", activityId: "A4050", name: "Update comments from CP and Stakeholders", type: "activity", totalHours: 5, start: "28-Apr-26", finish: "04-May-26", forecastTotalHours: 5, status: "Not Started", children: [] },
          { id: "a4060", activityId: "A4060", name: "Final Issue", type: "activity", totalHours: 2, start: "05-May-26", finish: "06-May-26", forecastTotalHours: 2, status: "Not Started", children: [] },
        ],
      },
    ],
  },
  {
    id: "s14", name: "14. GI GAP Analysis", type: "scope",
    totalHours: 51, start: "20-Jan-26", finish: "31-Mar-26", forecastTotalHours: 51, status: "", children: [
      { id: "a4070", activityId: "A4070", name: "Review", type: "activity", totalHours: 51, start: "20-Jan-26", finish: "31-Mar-26", forecastTotalHours: 20, status: "In Progress", children: [] },
      { id: "a4080", activityId: "A4080", name: "CAD Support", type: "activity", totalHours: 41, start: "03-Feb-26", finish: "31-Mar-26", forecastTotalHours: 41, status: "In Progress", children: [] },
      { id: "a4090", activityId: "A4090", name: "Draft Report", type: "activity", totalHours: 10, start: "17-Feb-26", finish: "02-Mar-26", forecastTotalHours: 10, status: "In Progress", children: [] },
      { id: "a4100", activityId: "A4100", name: "Internal review", type: "activity", totalHours: 2, start: "03-Mar-26", finish: "04-Mar-26", forecastTotalHours: 2, status: "Not Started", children: [] },
      { id: "a4110", activityId: "A4110", name: "Issue draft to CP", type: "activity", totalHours: 2, start: "05-Mar-26", finish: "06-Mar-26", forecastTotalHours: 2, status: "Not Started", children: [] },
      { id: "a4120", activityId: "A4120", name: "CP Review", type: "activity", totalHours: 10, start: "09-Mar-26", finish: "20-Mar-26", forecastTotalHours: 10, status: "Not Started", children: [] },
      { id: "a4130", activityId: "A4130", name: "Presentation to Stakeholders", type: "activity", totalHours: 1, start: "23-Mar-26", finish: "23-Mar-26", forecastTotalHours: 1, status: "Not Started", children: [] },
      { id: "a4140", activityId: "A4140", name: "Update comments from CP and Stakeholders", type: "activity", totalHours: 5, start: "24-Mar-26", finish: "30-Mar-26", forecastTotalHours: 5, status: "Not Started", children: [] },
      { id: "a4150", activityId: "A4150", name: "Final Issue", type: "activity", totalHours: 1, start: "31-Mar-26", finish: "31-Mar-26", forecastTotalHours: 1, status: "Not Started", children: [] },
    ],
  },
  {
    id: "s15", name: "15. LUL Charing Cross", type: "scope",
    totalHours: 95, start: "02-Feb-26", finish: "12-Jun-26", forecastTotalHours: null, status: "", children: [
      { id: "a4170", activityId: "A4170", name: "Initial assessment", type: "activity", totalHours: 15, start: "02-Feb-26", finish: "20-Feb-26", forecastTotalHours: null, status: "In Progress", children: [] },
      { id: "a4180", activityId: "A4180", name: "Workshop MDJV/LUL", type: "activity", totalHours: 8, start: "23-Feb-26", finish: "04-Mar-26", forecastTotalHours: null, status: "Not Started", children: [] },
      { id: "a4190", activityId: "A4190", name: "Detail Assessment", type: "activity", totalHours: 45, start: "25-Feb-26", finish: "28-Apr-26", forecastTotalHours: null, status: "Not Started", children: [] },
      { id: "a4200", activityId: "A4200", name: "Draft Report", type: "activity", totalHours: 10, start: "29-Apr-26", finish: "12-May-26", forecastTotalHours: null, status: "Not Started", children: [] },
      { id: "a4210", activityId: "A4210", name: "Internal review", type: "activity", totalHours: 2, start: "13-May-26", finish: "14-May-26", forecastTotalHours: null, status: "Not Started", children: [] },
      { id: "a4220", activityId: "A4220", name: "Issue draft to CP", type: "activity", totalHours: 2, start: "15-May-26", finish: "18-May-26", forecastTotalHours: null, status: "Not Started", children: [] },
      { id: "a4230", activityId: "A4230", name: "CP Review", type: "activity", totalHours: 10, start: "19-May-26", finish: "01-Jun-26", forecastTotalHours: null, status: "Not Started", children: [] },
      { id: "a4240", activityId: "A4240", name: "Presentation to Stakeholders", type: "activity", totalHours: 2, start: "02-Jun-26", finish: "03-Jun-26", forecastTotalHours: null, status: "Not Started", children: [] },
      { id: "a4250", activityId: "A4250", name: "Update comments from CP and Stakeholders", type: "activity", totalHours: 5, start: "04-Jun-26", finish: "10-Jun-26", forecastTotalHours: null, status: "Not Started", children: [] },
      { id: "a4260", activityId: "A4260", name: "Final Issue", type: "activity", totalHours: 2, start: "11-Jun-26", finish: "12-Jun-26", forecastTotalHours: null, status: "Not Started", children: [] },
    ],
  },
  {
    id: "s16", name: "16. Tunnel GIR", type: "scope",
    totalHours: 64, start: "02-Feb-26", finish: "30-Apr-26", forecastTotalHours: null, status: "", children: [
      { id: "a4270", activityId: "A4270", name: "Review", type: "activity", totalHours: 30, start: "02-Feb-26", finish: "13-Mar-26", forecastTotalHours: null, status: "In Progress", children: [] },
      { id: "a4280", activityId: "A4280", name: "Draft Report", type: "activity", totalHours: 10, start: "16-Mar-26", finish: "27-Mar-26", forecastTotalHours: null, status: "Not Started", children: [] },
      { id: "a4290", activityId: "A4290", name: "Internal review", type: "activity", totalHours: 2, start: "30-Mar-26", finish: "31-Mar-26", forecastTotalHours: null, status: "Not Started", children: [] },
      { id: "a4300", activityId: "A4300", name: "Issue draft to CP", type: "activity", totalHours: 2, start: "01-Apr-26", finish: "02-Apr-26", forecastTotalHours: null, status: "Not Started", children: [] },
      { id: "a4310", activityId: "A4310", name: "CP Review", type: "activity", totalHours: 10, start: "03-Apr-26", finish: "16-Apr-26", forecastTotalHours: null, status: "Not Started", children: [] },
      { id: "a4320", activityId: "A4320", name: "Presentation to Stakeholders", type: "activity", totalHours: 2, start: "17-Apr-26", finish: "20-Apr-26", forecastTotalHours: null, status: "Not Started", children: [] },
      { id: "a4330", activityId: "A4330", name: "Update comments from CP and Stakeholders", type: "activity", totalHours: 5, start: "21-Apr-26", finish: "27-Apr-26", forecastTotalHours: null, status: "Not Started", children: [] },
      { id: "a4340", activityId: "A4340", name: "Final Issue", type: "activity", totalHours: 3, start: "28-Apr-26", finish: "30-Apr-26", forecastTotalHours: null, status: "Not Started", children: [] },
    ],
  },
  {
    id: "s17", name: "17. ECI Euston House & NR _Geobear", type: "scope",
    totalHours: 72, start: "26-Jan-26", finish: "05-May-26", forecastTotalHours: null, status: "", children: [
      { id: "a4350", activityId: "A4350", name: "Workshop 1 NR MDJV (TBC)", type: "activity", totalHours: 1, start: "26-Jan-26", finish: "26-Jan-26", forecastTotalHours: null, status: "Not Started", children: [] },
      { id: "a4360", activityId: "A4360", name: "Workshop 2 EH MDJV (TBC)", type: "activity", totalHours: 1, start: "26-Jan-26", finish: "26-Jan-26", forecastTotalHours: null, status: "Not Started", children: [] },
      { id: "a4370", activityId: "A4370", name: "Review scope and deliverables, prepare programme", type: "activity", totalHours: 10, start: "28-Jan-26", finish: "10-Feb-26", forecastTotalHours: null, status: "Completed", children: [] },
      { id: "a4380", activityId: "A4380", name: "Ongoing coordination with Geobear", type: "activity", totalHours: 70, start: "28-Jan-26", finish: "05-May-26", forecastTotalHours: null, status: "Not Started", children: [] },
      { id: "a4390", activityId: "A4390", name: "Risk Register", type: "activity", totalHours: 62, start: "30-Jan-26", finish: "27-Apr-26", forecastTotalHours: null, status: "Not Started", children: [] },
      { id: "a4400", activityId: "A4400", name: "Assumption Register", type: "activity", totalHours: 62, start: "09-Feb-26", finish: "05-May-26", forecastTotalHours: null, status: "Not Started", children: [] },
      { id: "a4410", activityId: "A4410", name: "Kick of meeting - Geobear", type: "activity", totalHours: 2, start: "11-Feb-26", finish: "12-Feb-26", forecastTotalHours: null, status: "Completed", children: [] },
      { id: "a4420", activityId: "A4420", name: "Draft drawings", type: "activity", totalHours: 20, start: "02-Mar-26", finish: "27-Mar-26", forecastTotalHours: null, status: "Not Started", children: [] },
      { id: "a4430", activityId: "A4430", name: "Draft Report", type: "activity", totalHours: 10, start: "16-Mar-26", finish: "27-Mar-26", forecastTotalHours: null, status: "Not Started", children: [] },
      { id: "a4440", activityId: "A4440", name: "Internal review - Report / Drawings", type: "activity", totalHours: 5, start: "30-Mar-26", finish: "03-Apr-26", forecastTotalHours: null, status: "Not Started", children: [] },
      { id: "a4450", activityId: "A4450", name: "Issue draft to CP - Report / Drawings", type: "activity", totalHours: 2, start: "06-Apr-26", finish: "07-Apr-26", forecastTotalHours: null, status: "Not Started", children: [] },
      { id: "a4460", activityId: "A4460", name: "CP Review", type: "activity", totalHours: 10, start: "08-Apr-26", finish: "21-Apr-26", forecastTotalHours: null, status: "Not Started", children: [] },
      { id: "a4470", activityId: "A4470", name: "Update comments", type: "activity", totalHours: 5, start: "22-Apr-26", finish: "28-Apr-26", forecastTotalHours: null, status: "Not Started", children: [] },
      { id: "a4480", activityId: "A4480", name: "Final Issue", type: "activity", totalHours: 2, start: "29-Apr-26", finish: "30-Apr-26", forecastTotalHours: null, status: "Not Started", children: [] },
    ],
  },
  {
    id: "s18", name: "18. Euston street GMA updates (impacts to residual buildings)", type: "scope",
    totalHours: 51, start: "02-Feb-26", finish: "13-Apr-26", forecastTotalHours: null, status: "", children: [
      { id: "a4490", activityId: "A4490", name: "Desk study", type: "activity", totalHours: 10, start: "02-Feb-26", finish: "13-Feb-26", forecastTotalHours: null, status: "Completed", children: [] },
      { id: "a4500", activityId: "A4500", name: "Assessment", type: "activity", totalHours: 10, start: "16-Feb-26", finish: "27-Feb-26", forecastTotalHours: null, status: "In Progress", children: [] },
      { id: "a4510", activityId: "A4510", name: "Draft Report", type: "activity", totalHours: 10, start: "02-Mar-26", finish: "13-Mar-26", forecastTotalHours: null, status: "Not Started", children: [] },
      { id: "a4520", activityId: "A4520", name: "Internal review", type: "activity", totalHours: 2, start: "16-Mar-26", finish: "17-Mar-26", forecastTotalHours: null, status: "Not Started", children: [] },
      { id: "a4530", activityId: "A4530", name: "Issue draft to CP", type: "activity", totalHours: 2, start: "18-Mar-26", finish: "19-Mar-26", forecastTotalHours: null, status: "Not Started", children: [] },
      { id: "a4540", activityId: "A4540", name: "CP Review", type: "activity", totalHours: 10, start: "20-Mar-26", finish: "02-Apr-26", forecastTotalHours: null, status: "Not Started", children: [] },
      { id: "a4550", activityId: "A4550", name: "Update comments", type: "activity", totalHours: 5, start: "03-Apr-26", finish: "09-Apr-26", forecastTotalHours: null, status: "Not Started", children: [] },
      { id: "a4560", activityId: "A4560", name: "Final Issue", type: "activity", totalHours: 2, start: "10-Apr-26", finish: "13-Apr-26", forecastTotalHours: null, status: "Not Started", children: [] },
      {
        id: "t18-1", name: "18.1. Settlement Deeds (TBC)", type: "task",
        totalHours: 46, start: "09-Feb-26", finish: "13-Apr-26", forecastTotalHours: null, status: "", children: [
          { id: "a4570", activityId: "A4570", name: "Get: List of buildings", type: "activity", totalHours: 5, start: "09-Feb-26", finish: "13-Feb-26", forecastTotalHours: null, status: "Not Started", children: [] },
          { id: "a4580", activityId: "A4580", name: "Settlement reports TBC as per NR of reports identified (TBC)", type: "activity", totalHours: 10, start: "16-Feb-26", finish: "27-Feb-26", forecastTotalHours: null, status: "Not Started", children: [] },
          { id: "a4590", activityId: "A4590", name: "Draft Report (TBC)", type: "activity", totalHours: 10, start: "02-Mar-26", finish: "13-Mar-26", forecastTotalHours: null, status: "Not Started", children: [] },
          { id: "a4600", activityId: "A4600", name: "Internal review (TBC)", type: "activity", totalHours: 2, start: "16-Mar-26", finish: "17-Mar-26", forecastTotalHours: null, status: "Not Started", children: [] },
          { id: "a4610", activityId: "A4610", name: "Issue draft to CP (TBC)", type: "activity", totalHours: 2, start: "18-Mar-26", finish: "19-Mar-26", forecastTotalHours: null, status: "Not Started", children: [] },
          { id: "a4620", activityId: "A4620", name: "CP Review (TBC)", type: "activity", totalHours: 10, start: "20-Mar-26", finish: "02-Apr-26", forecastTotalHours: null, status: "Not Started", children: [] },
          { id: "a4630", activityId: "A4630", name: "Update comments (TBC)", type: "activity", totalHours: 5, start: "03-Apr-26", finish: "09-Apr-26", forecastTotalHours: null, status: "Not Started", children: [] },
          { id: "a4640", activityId: "A4640", name: "Final Issue (TBC)", type: "activity", totalHours: 2, start: "10-Apr-26", finish: "13-Apr-26", forecastTotalHours: null, status: "Not Started", children: [] },
        ],
      },
    ],
  },
  {
    id: "s19", name: "19. Utilities South Watermain & TAS LU met line", type: "scope",
    totalHours: 43, start: "09-Feb-26", finish: "08-Apr-26", forecastTotalHours: null, status: "", children: [
      { id: "a4650", activityId: "A4650", name: "Assesment", type: "activity", totalHours: 10, start: "09-Feb-26", finish: "20-Feb-26", forecastTotalHours: null, status: "Completed", children: [] },
      { id: "a4660", activityId: "A4660", name: "Draft Report", type: "activity", totalHours: 10, start: "23-Feb-26", finish: "06-Mar-26", forecastTotalHours: null, status: "Completed", children: [] },
      { id: "a4670", activityId: "A4670", name: "Meeting with LU (TBC)", type: "activity", totalHours: 5, start: "02-Mar-26", finish: "06-Mar-26", forecastTotalHours: null, status: "Not Started", children: [] },
      { id: "a4680", activityId: "A4680", name: "Internal review", type: "activity", totalHours: 2, start: "09-Mar-26", finish: "10-Mar-26", forecastTotalHours: null, status: "Not Started", children: [] },
      { id: "a4690", activityId: "A4690", name: "Issue draft to CP", type: "activity", totalHours: 2, start: "11-Mar-26", finish: "12-Mar-26", forecastTotalHours: null, status: "Not Started", children: [] },
      { id: "a4700", activityId: "A4700", name: "CP Review", type: "activity", totalHours: 10, start: "13-Mar-26", finish: "26-Mar-26", forecastTotalHours: null, status: "Not Started", children: [] },
      { id: "a4710", activityId: "A4710", name: "Presentation to Stakeholders", type: "activity", totalHours: 2, start: "27-Mar-26", finish: "30-Mar-26", forecastTotalHours: null, status: "Not Started", children: [] },
      { id: "a4720", activityId: "A4720", name: "Update comments from CP and Stakeholders", type: "activity", totalHours: 5, start: "31-Mar-26", finish: "06-Apr-26", forecastTotalHours: null, status: "Not Started", children: [] },
      { id: "a4730", activityId: "A4730", name: "Final Issue", type: "activity", totalHours: 2, start: "07-Apr-26", finish: "08-Apr-26", forecastTotalHours: null, status: "Not Started", children: [] },
    ],
  },
];

// ── Date helpers ────────────────────────────────────────────────────────────
const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAY_NAMES   = ["Mo","Tu","We","Th","Fr","Sa","Su"];

function parseProgrammeDate(str: string): Date | null {
  if (!str) return null;
  const parts = str.split("-");
  if (parts.length !== 3) return null;
  const day = parseInt(parts[0], 10);
  const mi  = MONTH_NAMES.findIndex(m => m.toLowerCase() === parts[1].toLowerCase());
  if (mi === -1 || isNaN(day)) return null;
  const yr  = parseInt(parts[2], 10);
  return new Date(yr < 100 ? 2000 + yr : yr, mi, day);
}

function formatProgrammeDate(d: Date): string {
  return `${String(d.getDate()).padStart(2,"0")}-${MONTH_NAMES[d.getMonth()]}-${String(d.getFullYear()).slice(-2)}`;
}

// ── Mini Calendar ────────────────────────────────────────────────────────────
interface CalendarState {
  nodeId: string;
  field: "start" | "finish";
  value: string;
  rect: { top: number; left: number; width: number; height: number };
}

function MiniCalendar({ value, anchorRect, onChange, onClose }: {
  value: string;
  anchorRect: { top: number; left: number; width: number; height: number };
  onChange: (v: string) => void;
  onClose: () => void;
}) {
  const parsed = parseProgrammeDate(value);
  const [view, setView] = useState<Date>(parsed ?? new Date(2026, 0, 1));
  const year  = view.getFullYear();
  const month = view.getMonth();

  const firstDow = (() => { const d = new Date(year, month, 1).getDay() - 1; return d < 0 ? 6 : d; })();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <>
      <div className="fixed inset-0 z-[99]" onClick={onClose} />
      <div
        className="fixed z-[100] w-56 rounded-lg border border-zinc-200 bg-white p-3 shadow-xl"
        style={{ top: anchorRect.top + anchorRect.height + 4, left: anchorRect.left }}
        onClick={e => e.stopPropagation()}
      >
        {/* Month nav */}
        <div className="mb-2.5 flex items-center justify-between">
          <button
            className="rounded p-1 text-zinc-500 hover:bg-zinc-100"
            onClick={() => setView(new Date(year, month - 1, 1))}
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-xs font-semibold text-zinc-700">{MONTH_NAMES[month]} {year}</span>
          <button
            className="rounded p-1 text-zinc-500 hover:bg-zinc-100"
            onClick={() => setView(new Date(year, month + 1, 1))}
          >
            <ChevronRight size={14} />
          </button>
        </div>
        {/* Day-of-week headers */}
        <div className="mb-1 grid grid-cols-7">
          {DAY_NAMES.map(d => (
            <div key={d} className="py-0.5 text-center text-[10px] font-medium text-zinc-400">{d}</div>
          ))}
        </div>
        {/* Day grid */}
        <div className="grid grid-cols-7 gap-y-0.5">
          {cells.map((day, i) => {
            if (day === null) return <div key={i} />;
            const isSelected = parsed &&
              parsed.getFullYear() === year &&
              parsed.getMonth()    === month &&
              parsed.getDate()     === day;
            return (
              <div key={i} className="flex justify-center">
                <button
                  className={`h-7 w-7 rounded-full text-xs transition-colors ${
                    isSelected
                      ? "bg-zinc-900 font-semibold text-white"
                      : "text-zinc-700 hover:bg-zinc-100"
                  }`}
                  onClick={() => { onChange(formatProgrammeDate(new Date(year, month, day))); onClose(); }}
                >
                  {day}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  if (status === "Completed")
    return <span className="rounded px-1.5 py-0.5 text-xs font-medium bg-green-100 text-green-700">Completed</span>;
  if (status === "In Progress")
    return <span className="rounded px-1.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-700">In Progress</span>;
  if (status === "Not Started")
    return <span className="rounded px-1.5 py-0.5 text-xs font-medium bg-zinc-100 text-zinc-500">Not Started</span>;
  return null;
}

// ── Tree helpers ─────────────────────────────────────────────────────────────
type AddOptions = { label: string; type: NodeType }[];

function getAddOptions(nodeType: NodeType): AddOptions {
  if (nodeType === "scope")   return [{ label: "Add Task", type: "task" }, { label: "Add Activity", type: "activity" }];
  if (nodeType === "task")    return [{ label: "Add Subtask", type: "subtask" }, { label: "Add Activity", type: "activity" }];
  if (nodeType === "subtask") return [{ label: "Add Activity", type: "activity" }];
  return [];
}

function updateNodeInTree(
  nodes: ProgrammeNode[],
  nodeId: string,
  field: keyof ProgrammeNode,
  value: ProgrammeNode[keyof ProgrammeNode],
): ProgrammeNode[] {
  return nodes.map(n => {
    if (n.id === nodeId) return { ...n, [field]: value };
    return { ...n, children: updateNodeInTree(n.children, nodeId, field, value) };
  });
}

function addNodeToTree(nodes: ProgrammeNode[], parentId: string, newNode: ProgrammeNode): ProgrammeNode[] {
  return nodes.map(n => {
    if (n.id === parentId) return { ...n, children: [...n.children, newNode] };
    return { ...n, children: addNodeToTree(n.children, parentId, newNode) };
  });
}

// ── Add-form types ────────────────────────────────────────────────────────────
interface AddFormState { parentId: string; type: NodeType; }
interface FormValues {
  name: string; activityId: string; totalHours: string;
  start: string; finish: string; forecastTotalHours: string; status: string;
}
const defaultForm: FormValues = {
  name: "", activityId: "", totalHours: "", start: "", finish: "", forecastTotalHours: "", status: "Not Started",
};

// ── Editing types ─────────────────────────────────────────────────────────────
type EditableField = "name" | "totalHours" | "forecastTotalHours" | "status";
interface EditingCell { nodeId: string; field: EditableField; value: string; }

// ── Main component ────────────────────────────────────────────────────────────
export function ProgrammeTab() {
  const [data,         setData]         = useState<ProgrammeNode[]>(initialData);
  const [collapsed,    setCollapsed]    = useState<Set<string>>(new Set());
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [addForm,      setAddForm]      = useState<AddFormState | null>(null);
  const [formValues,   setFormValues]   = useState<FormValues>(defaultForm);
  const [editingCell,  setEditingCell]  = useState<EditingCell | null>(null);
  const [calendar,     setCalendar]     = useState<CalendarState | null>(null);

  const saveField = (nodeId: string, field: keyof ProgrammeNode, raw: string) => {
    const value =
      (field === "totalHours" || field === "forecastTotalHours")
        ? (raw === "" ? null : Number(raw))
        : raw;
    setData(prev => updateNodeInTree(prev, nodeId, field, value as ProgrammeNode[keyof ProgrammeNode]));
  };

  const commitEdit = () => {
    if (!editingCell) return;
    saveField(editingCell.nodeId, editingCell.field as keyof ProgrammeNode, editingCell.value);
    setEditingCell(null);
  };

  const toggleCollapse = (id: string) => {
    setCollapsed(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  };

  const handleAdd = () => {
    if (!addForm || !formValues.name.trim()) return;
    const newNode: ProgrammeNode = {
      id: `user-${Date.now()}`,
      activityId: formValues.activityId || undefined,
      name: formValues.name.trim(),
      type: addForm.type,
      totalHours: formValues.totalHours ? Number(formValues.totalHours) : null,
      start: formValues.start,
      finish: formValues.finish,
      forecastTotalHours: formValues.forecastTotalHours ? Number(formValues.forecastTotalHours) : null,
      status: formValues.status,
      children: [],
    };
    setData(prev => addNodeToTree(prev, addForm.parentId, newNode));
    setAddForm(null);
    setFormValues(defaultForm);
  };

  const isEditing = (nodeId: string, field: EditableField) =>
    editingCell?.nodeId === nodeId && editingCell?.field === field;

  const startEdit = (nodeId: string, field: EditableField, current: string) => {
    setCalendar(null);
    setEditingCell({ nodeId, field, value: current });
  };

  const openCal = (nodeId: string, field: "start" | "finish", value: string, e: React.MouseEvent<HTMLElement>) => {
    setEditingCell(null);
    const r = e.currentTarget.getBoundingClientRect();
    setCalendar({ nodeId, field, value, rect: { top: r.top, left: r.left, width: r.width, height: r.height } });
  };

  const renderNode = (node: ProgrammeNode, depth: number): React.ReactNode => {
    const isCollapsed = collapsed.has(node.id);
    const hasChildren = node.children.length > 0;
    const addOptions  = getAddOptions(node.type);
    const canEdit     = true;

    const rowBg = node.type === "scope" ? "bg-red-100" : node.type === "task" ? "bg-zinc-100" : node.type === "subtask" ? "bg-zinc-50" : "bg-white";
    const textCls = node.type === "scope" ? "font-semibold text-red-900" : node.type === "task" || node.type === "subtask" ? "font-medium text-zinc-800" : "text-zinc-700";
    const hover = canEdit ? "cursor-pointer rounded px-0.5 py-0.5 hover:bg-black/[.06]" : "";

    return (
      <div key={node.id}>
        <div className={`flex items-center border-b border-zinc-100 text-sm ${rowBg}`}>

          {/* ── Name ── */}
          <div
            className={`flex flex-1 items-center gap-1 py-1.5 pr-3 min-w-0 ${textCls}`}
            style={{ paddingLeft: `${12 + depth * 20}px` }}
          >
            {hasChildren
              ? <button onClick={() => toggleCollapse(node.id)} className="shrink-0 mr-0.5 text-zinc-400 hover:text-zinc-600">{isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}</button>
              : <span className="w-4 shrink-0" />}
            {node.activityId && <span className="shrink-0 font-mono text-xs text-zinc-400 mr-1">{node.activityId}</span>}
            {isEditing(node.id, "name") ? (
              <input
                autoFocus
                className="flex-1 min-w-0 rounded border border-blue-400 bg-white px-1.5 py-0.5 text-sm text-zinc-800 outline-none ring-1 ring-blue-200"
                value={editingCell!.value}
                onChange={e => setEditingCell(p => p ? { ...p, value: e.target.value } : p)}
                onBlur={commitEdit}
                onKeyDown={e => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditingCell(null); }}
              />
            ) : (
              <span
                className={`truncate ${hover}`}
                onClick={() => canEdit && startEdit(node.id, "name", node.name)}
                title={canEdit ? "Click to edit" : undefined}
              >
                {node.name}
              </span>
            )}
          </div>

          {/* ── Total Hours ── */}
          <div className="w-24 shrink-0 px-2 py-1.5 text-right text-zinc-600 tabular-nums">
            {isEditing(node.id, "totalHours") ? (
              <input
                autoFocus type="number"
                className="w-full rounded border border-blue-400 bg-white px-1.5 py-0.5 text-sm text-right outline-none ring-1 ring-blue-200"
                value={editingCell!.value}
                onChange={e => setEditingCell(p => p ? { ...p, value: e.target.value } : p)}
                onBlur={commitEdit}
                onKeyDown={e => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditingCell(null); }}
              />
            ) : (
              <span className={hover} onClick={() => canEdit && startEdit(node.id, "totalHours", String(node.totalHours ?? ""))}>
                {node.totalHours ?? "—"}
              </span>
            )}
          </div>

          {/* ── Start (calendar) ── */}
          <div className="w-28 shrink-0 px-2 py-1.5">
            <span
              className={`inline-block font-mono text-xs text-zinc-500 ${hover}`}
              onClick={e => canEdit && openCal(node.id, "start", node.start, e)}
              title={canEdit ? "Click to pick date" : undefined}
            >
              {node.start || "—"}
            </span>
          </div>

          {/* ── Finish (calendar) ── */}
          <div className="w-28 shrink-0 px-2 py-1.5">
            <span
              className={`inline-block font-mono text-xs text-zinc-500 ${hover}`}
              onClick={e => canEdit && openCal(node.id, "finish", node.finish, e)}
              title={canEdit ? "Click to pick date" : undefined}
            >
              {node.finish || "—"}
            </span>
          </div>

          {/* ── Forecast Hours ── */}
          <div className="w-28 shrink-0 px-2 py-1.5 text-right text-zinc-600 tabular-nums">
            {isEditing(node.id, "forecastTotalHours") ? (
              <input
                autoFocus type="number"
                className="w-full rounded border border-blue-400 bg-white px-1.5 py-0.5 text-sm text-right outline-none ring-1 ring-blue-200"
                value={editingCell!.value}
                onChange={e => setEditingCell(p => p ? { ...p, value: e.target.value } : p)}
                onBlur={commitEdit}
                onKeyDown={e => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditingCell(null); }}
              />
            ) : (
              <span className={hover} onClick={() => canEdit && startEdit(node.id, "forecastTotalHours", String(node.forecastTotalHours ?? ""))}>
                {node.forecastTotalHours ?? "—"}
              </span>
            )}
          </div>

          {/* ── Status (dropdown) ── */}
          <div className="w-28 shrink-0 px-2 py-1.5">
            {isEditing(node.id, "status") ? (
              <select
                autoFocus
                className="w-full rounded border border-blue-400 bg-white px-1 py-0.5 text-xs outline-none ring-1 ring-blue-200"
                value={editingCell!.value}
                onChange={e => {
                  saveField(node.id, "status", e.target.value);
                  setEditingCell(null);
                }}
                onBlur={() => setEditingCell(null)}
              >
                <option>Not Started</option>
                <option>In Progress</option>
                <option>Completed</option>
              </select>
            ) : node.status ? (
              <span
                className={`inline-block rounded ${node.type === "activity" ? "cursor-pointer hover:opacity-80" : ""}`}
                onClick={() => node.type === "activity" && startEdit(node.id, "status", node.status)}
                title={node.type === "activity" ? "Click to change status" : undefined}
              >
                <StatusBadge status={node.status} />
              </span>
            ) : null}
          </div>

          {/* ── Add dropdown ── */}
          <div className="w-16 shrink-0 flex items-center justify-center py-1.5 relative">
            {addOptions.length > 0 && (
              <>
                <button
                  onClick={() => setOpenDropdown(openDropdown === node.id ? null : node.id)}
                  className="flex items-center gap-0.5 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-600 shadow-sm transition-colors hover:border-zinc-400 hover:bg-zinc-50 hover:text-zinc-800"
                >
                  <Plus size={12} strokeWidth={2.5} />
                  Add
                </button>
                {openDropdown === node.id && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setOpenDropdown(null)} />
                    <div className="absolute right-0 top-full z-20 mt-1 min-w-max rounded-md border border-zinc-200 bg-white shadow-lg text-xs">
                      {addOptions.map(opt => (
                        <button
                          key={opt.type}
                          className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-zinc-700 hover:bg-zinc-50 whitespace-nowrap first:rounded-t-md last:rounded-b-md"
                          onClick={() => { setOpenDropdown(null); setAddForm({ parentId: node.id, type: opt.type }); setFormValues(defaultForm); }}
                        >
                          <Plus size={11} className="text-zinc-400" />
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
        {!isCollapsed && node.children.map(child => renderNode(child, depth + 1))}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Table header */}
      <div className="flex shrink-0 items-center border-b-2 border-zinc-200 bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-400">
        <div className="flex-1 px-3 py-2.5">Activity Name</div>
        <div className="w-24 shrink-0 px-3 py-2.5 text-right">Total Hours</div>
        <div className="w-28 shrink-0 px-3 py-2.5">Start</div>
        <div className="w-28 shrink-0 px-3 py-2.5">Finish</div>
        <div className="w-28 shrink-0 px-3 py-2.5 text-right">Forecast Hrs</div>
        <div className="w-28 shrink-0 px-3 py-2.5">Status</div>
        <div className="w-16 shrink-0" />
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto">
        {data.map(node => renderNode(node, 0))}
      </div>

      {/* Mini calendar portal */}
      {calendar && (
        <MiniCalendar
          value={calendar.value}
          anchorRect={calendar.rect}
          onChange={v => {
            saveField(calendar.nodeId, calendar.field, v);
            setCalendar(null);
          }}
          onClose={() => setCalendar(null)}
        />
      )}

      {/* Add modal */}
      {addForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25">
          <div className="w-96 rounded-lg border border-zinc-200 bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-800 capitalize">Add {addForm.type}</h3>
              <button onClick={() => setAddForm(null)} className="text-zinc-400 hover:text-zinc-600"><X size={16} /></button>
            </div>
            <div className="space-y-3">
              {addForm.type === "activity" && (
                <div>
                  <label className="mb-1 block text-xs text-zinc-500">Activity ID</label>
                  <input className="w-full rounded border border-zinc-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-400" value={formValues.activityId} onChange={e => setFormValues(p => ({ ...p, activityId: e.target.value }))} placeholder="e.g. A5000" />
                </div>
              )}
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Name *</label>
                <input autoFocus className="w-full rounded border border-zinc-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-400" value={formValues.name} onChange={e => setFormValues(p => ({ ...p, name: e.target.value }))} placeholder="Enter name" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs text-zinc-500">Start</label>
                  <input className="w-full rounded border border-zinc-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-400" value={formValues.start} onChange={e => setFormValues(p => ({ ...p, start: e.target.value }))} placeholder="dd-Mmm-yy" />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-zinc-500">Finish</label>
                  <input className="w-full rounded border border-zinc-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-400" value={formValues.finish} onChange={e => setFormValues(p => ({ ...p, finish: e.target.value }))} placeholder="dd-Mmm-yy" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs text-zinc-500">Total Hours</label>
                  <input type="number" className="w-full rounded border border-zinc-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-400" value={formValues.totalHours} onChange={e => setFormValues(p => ({ ...p, totalHours: e.target.value }))} />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-zinc-500">Forecast Hours</label>
                  <input type="number" className="w-full rounded border border-zinc-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-400" value={formValues.forecastTotalHours} onChange={e => setFormValues(p => ({ ...p, forecastTotalHours: e.target.value }))} />
                </div>
              </div>
              {addForm.type === "activity" && (
                <div>
                  <label className="mb-1 block text-xs text-zinc-500">Status</label>
                  <select className="w-full rounded border border-zinc-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-400" value={formValues.status} onChange={e => setFormValues(p => ({ ...p, status: e.target.value }))}>
                    <option>Not Started</option>
                    <option>In Progress</option>
                    <option>Completed</option>
                  </select>
                </div>
              )}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setAddForm(null)} className="rounded px-3 py-1.5 text-sm text-zinc-500 hover:text-zinc-700">Cancel</button>
              <button onClick={handleAdd} className="rounded bg-zinc-900 px-3 py-1.5 text-sm text-white hover:bg-zinc-700 disabled:opacity-40" disabled={!formValues.name.trim()}>Add</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
