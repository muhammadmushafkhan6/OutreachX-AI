import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { User, Instagram } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthStore } from "@/stores/authStore";
import { api, getApiErrorMessage } from "@/lib/api";
import { toast } from "sonner";

const profileSchema = z.object({
  full_name: z.string().min(2),
  email: z.string().email(),
  instagram_username: z.string().optional(),
});

type ProfileForm = z.infer<typeof profileSchema>;

export function Settings() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: user?.full_name ?? "",
      email: user?.email ?? "",
      instagram_username: user?.instagram_username ?? "",
    },
  });

  const onSave = async (data: ProfileForm) => {
    try {
      const res = await api.put("/users/me", data);
      setUser(res.data);
      toast.success("Profile updated successfully");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to update profile"));
    }
  };

  return (
    <div className="space-y-8 max-w-2xl animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account and preferences</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4" /> Profile
          </CardTitle>
          <CardDescription>Update your personal information</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSave)} className="space-y-4">
            <Input
              id="full_name"
              label="Full name"
              error={errors.full_name?.message}
              {...register("full_name")}
            />
            <Input
              id="email"
              label="Email"
              type="email"
              error={errors.email?.message}
              {...register("email")}
            />
            <div className="space-y-2">
              <label className="text-sm font-medium">Instagram Username</label>
              <div className="relative">
                <Input
                  id="instagram_username"
                  placeholder="your_handle"
                  className="pl-10"
                  error={errors.instagram_username?.message}
                  {...register("instagram_username")}
                />
                <Instagram className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground">
                Connecting your Instagram allows you to DM leads directly from your account.
              </p>
            </div>
            <Button type="submit" loading={isSubmitting}>Save changes</Button>
          </form>
        </CardContent>
      </Card>


    </div>
  );
}
