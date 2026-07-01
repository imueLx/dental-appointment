import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CLINIC, clinicPhoneTel } from "@/lib/constants";

const ITEMS = [
  {
    icon: MapPin,
    label: "Address",
    value: `${CLINIC.address}, ${CLINIC.city}, ${CLINIC.country}`,
  },
  {
    icon: Phone,
    label: "Phone",
    value: CLINIC.phone,
    href: `tel:${clinicPhoneTel()}`,
  },
  {
    icon: Mail,
    label: "Email",
    value: CLINIC.email,
    href: `mailto:${CLINIC.email}`,
  },
  {
    icon: Clock,
    label: "Hours",
    value: `${CLINIC.hours}`,
    sub: `Lunch ${CLINIC.lunchBreak}`,
  },
] as const;

export function ClinicInfo() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Visit us</CardTitle>
      </CardHeader>
      <CardContent className="space-y-0">
        {ITEMS.map((item, i) => (
          <div key={item.label}>
            {i > 0 && <Separator className="my-4" />}
            <div className="flex gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <item.icon className="size-4" />
              </div>
              <div>
                <p className="text-sm font-medium">{item.label}</p>
                {"href" in item && item.href ? (
                  <a
                    href={item.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-primary"
                  >
                    {item.value}
                  </a>
                ) : (
                  <p className="text-sm text-muted-foreground">{item.value}</p>
                )}
                {"sub" in item && item.sub && (
                  <p className="text-sm text-muted-foreground">{item.sub}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
