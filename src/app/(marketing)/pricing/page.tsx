import { permanentRedirect } from "next/navigation";

/** Digital Twin is free; old /pricing links land on the "bring your own keys" section. */
export default function Pricing() {
  permanentRedirect("/#free");
}
