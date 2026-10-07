import { permissionLayout } from "@/lib/permission-layout";

// A real 403 for a role this page refuses; see `lib/permission-layout.tsx`.
export default permissionLayout("users.manage");
