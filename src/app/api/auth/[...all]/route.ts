import { getAuth } from "@/lib/auth";

const handle = async (req: Request) => (await getAuth()).handler(req);

export { handle as GET, handle as POST, handle as PATCH, handle as PUT, handle as DELETE };
