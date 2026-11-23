import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InstagramAccount } from "@/types";
import { instagramApi, getApiErrorMessage } from "@/lib/api";
import { toast } from "sonner";

export default function InstagramAccountsPage() {
  const [accounts, setAccounts] = useState<InstagramAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [username, setUsername] = useState("");
  const [cookie, setCookie] = useState("");

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const data = await instagramApi.list();
      setAccounts(data);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to load accounts"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !cookie.trim()) {
      toast.error("Please fill in all fields");
      return;
    }

    try {
      setConnecting(true);
      await instagramApi.connect({ username: username.trim(), instagram_cookie: cookie.trim() });
      toast.success("Instagram account connected successfully!");
      setUsername("");
      setCookie("");
      loadAccounts();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to connect account"));
    } finally {
      setConnecting(false);
    }
  };

  const handleDelete = async (accountId: string) => {
    if (!confirm("Are you sure you want to disconnect this account?")) return;

    try {
      await instagramApi.delete(accountId);
      toast.success("Instagram account disconnected");
      loadAccounts();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to disconnect account"));
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Instagram Accounts</h1>
        <p className="text-muted-foreground">Connect your Instagram accounts to send automated DMs</p>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        {/* Connect New Account */}
        <Card>
          <CardHeader>
            <CardTitle>Connect New Account</CardTitle>
            <CardDescription>Add your Instagram account to start sending DMs</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleConnect} className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Instagram Username</label>
                <Input
                  placeholder="e.g., johndoe"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Instagram Cookie</label>
                <Textarea
                  placeholder="Paste your Instagram cookie here..."
                  value={cookie}
                  onChange={(e) => setCookie(e.target.value)}
                  rows={6}
                />
                <p className="text-xs text-muted-foreground mt-2">
                  To get your cookie: Open Instagram in browser → F12 → Application → Cookies → Copy all cookies
                </p>
              </div>
              <Button type="submit" disabled={connecting} className="w-full">
                {connecting ? "Connecting..." : "Connect Account"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Connected Accounts */}
        <Card>
          <CardHeader>
            <CardTitle>Connected Accounts</CardTitle>
            <CardDescription>Manage your connected Instagram accounts</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : accounts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No Instagram accounts connected yet
              </div>
            ) : (
              <div className="space-y-3">
                {accounts.map((account) => (
                  <div key={account.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">@{account.username}</p>
                      <p className="text-xs text-muted-foreground">
                        Connected on {new Date(account.created_at).toLocaleDateString()}
                        {account.last_used_at && (
                          <> • Last used {new Date(account.last_used_at).toLocaleDateString()}</>
                        )}
                      </p>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(account.id)}
                    >
                      Disconnect
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
