"use client"

import { useState, useEffect, useRef } from "react"
import { useSession } from "next-auth/react"
import { useTheme } from "next-themes"
import { toast } from "sonner"
import { Building2, User, Bell, Shield, Palette, Globe, Save, Eye, EyeOff, Upload } from "lucide-react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const DEFAULT_NOTIFICATIONS = {
  emailNotifications: true,
  leaveRequests: true,
  attendanceAlerts: true,
  payrollReminders: true,
  newEmployees: false,
  weeklyReports: true,
}

const DEFAULT_APPEARANCE = {
  theme: "dark",
  sidebarCollapsed: false,
  compactMode: false,
}

function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function SettingsPageContent() {
  const { data: session } = useSession()
  const { setTheme } = useTheme()
  const isAdmin = session?.user?.role === "ADMIN"

  const [loading, setLoading] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [companySettings, setCompanySettings] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    website: "",
    timezone: "Asia/Kolkata",
    dateFormat: "DD/MM/YYYY",
    currency: "INR",
  })

  const [userSettings, setUserSettings] = useState({
    name: "",
    email: "",
    role: "",
  })

  const [notifications, setNotifications] = useState(DEFAULT_NOTIFICATIONS)
  const [appearance, setAppearance] = useState(DEFAULT_APPEARANCE)

  const [passwords, setPasswords] = useState({ current: "", newPass: "", confirm: "" })
  const [showPasswords, setShowPasswords] = useState({ current: false, newPass: false, confirm: false })

  // Load localStorage-based settings immediately (no session needed)
  useEffect(() => {
    const savedNotif = loadFromStorage("hr-notifications", DEFAULT_NOTIFICATIONS)
    const savedAppearance = loadFromStorage("hr-appearance", DEFAULT_APPEARANCE)
    setNotifications(savedNotif)
    setAppearance(savedAppearance)
    setTheme(savedAppearance.theme)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load DB-based settings when session is available
  useEffect(() => {
    if (!session?.user?.id) return

    setUserSettings(prev => ({
      ...prev,
      email: session.user?.email ?? "",
      role: session.user?.role === "ADMIN" ? "Admin" : "Employee",
    }))

    Promise.all([
      fetch("/api/settings/profile").then(r => r.json()),
      fetch("/api/settings/company").then(r => r.json()),
    ]).then(([profile, company]) => {
      if (!profile.error) {
        setUserSettings(prev => ({ ...prev, name: profile.name ?? "" }))
        if (profile.avatar) setAvatarUrl(profile.avatar)
      }
      if (!company.error) setCompanySettings(company)
    }).catch(err => console.error("Failed to load settings:", err))
  }, [session?.user?.id])

  const handleSaveCompany = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/settings/company", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(companySettings),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success("Company settings saved")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setLoading(false)
    }
  }

  const handleSaveProfile = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/settings/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: userSettings.name }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success("Profile updated")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setLoading(false)
    }
  }

  const handleSaveNotifications = () => {
    localStorage.setItem("hr-notifications", JSON.stringify(notifications))
    toast.success("Notification preferences saved")
  }

  const handleSaveAppearance = () => {
    localStorage.setItem("hr-appearance", JSON.stringify(appearance))
    setTheme(appearance.theme)
    toast.success("Appearance preferences saved")
  }

  const handleChangePassword = async () => {
    if (!passwords.current || !passwords.newPass || !passwords.confirm) {
      toast.error("All password fields are required")
      return
    }
    if (passwords.newPass !== passwords.confirm) {
      toast.error("New passwords do not match")
      return
    }
    if (passwords.newPass.length < 8) {
      toast.error("Password must be at least 8 characters")
      return
    }
    setLoading(true)
    try {
      const res = await fetch("/api/settings/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: passwords.current, newPassword: passwords.newPass }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success("Password changed successfully")
      setPasswords({ current: "", newPass: "", confirm: "" })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to change password")
    } finally {
      setLoading(false)
    }
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarUploading(true)
    try {
      const form = new FormData()
      form.append("avatar", file)
      const res = await fetch("/api/settings/avatar", { method: "POST", body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setAvatarUrl(data.avatarUrl)
      toast.success("Profile photo updated")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload photo")
    } finally {
      setAvatarUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const userInitials = userSettings.name
    ? userSettings.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
    : (session?.user?.initials ?? "?")

  return (
    <>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your account and application preferences.
        </p>
      </div>

      <Tabs defaultValue={isAdmin ? "company" : "profile"} className="space-y-6">
        <TabsList>
          {isAdmin && (
            <TabsTrigger value="company" className="gap-2">
              <Building2 className="size-4" />
              Company
            </TabsTrigger>
          )}
          <TabsTrigger value="profile" className="gap-2">
            <User className="size-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="size-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="appearance" className="gap-2">
            <Palette className="size-4" />
            Appearance
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Shield className="size-4" />
            Security
          </TabsTrigger>
        </TabsList>

        {/* Company Settings — admin only */}
        {isAdmin && <TabsContent value="company" className="space-y-6">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base">Company Information</CardTitle>
              <CardDescription>Update your company details and contact information.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Company Name</Label>
                  <Input
                    id="companyName"
                    value={companySettings.name}
                    onChange={(e) => setCompanySettings({ ...companySettings, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyEmail">Email</Label>
                  <Input
                    id="companyEmail"
                    type="email"
                    value={companySettings.email}
                    onChange={(e) => setCompanySettings({ ...companySettings, email: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="companyPhone">Phone</Label>
                  <Input
                    id="companyPhone"
                    value={companySettings.phone}
                    onChange={(e) => setCompanySettings({ ...companySettings, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyWebsite">Website</Label>
                  <Input
                    id="companyWebsite"
                    value={companySettings.website}
                    onChange={(e) => setCompanySettings({ ...companySettings, website: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyAddress">Address</Label>
                <Textarea
                  id="companyAddress"
                  value={companySettings.address}
                  onChange={(e) => setCompanySettings({ ...companySettings, address: e.target.value })}
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Globe className="size-4" />
                Regional Settings
              </CardTitle>
              <CardDescription>Configure timezone, date format, and currency preferences.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Timezone</Label>
                  <Select value={companySettings.timezone} onValueChange={(v) => setCompanySettings({ ...companySettings, timezone: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Asia/Kolkata">India (IST)</SelectItem>
                      <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                      <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                      <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                      <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                      <SelectItem value="Europe/London">London (GMT)</SelectItem>
                      <SelectItem value="Asia/Tokyo">Tokyo (JST)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Date Format</Label>
                  <Select value={companySettings.dateFormat} onValueChange={(v) => setCompanySettings({ ...companySettings, dateFormat: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                      <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                      <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Select value={companySettings.currency} onValueChange={(v) => setCompanySettings({ ...companySettings, currency: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INR">INR (₹)</SelectItem>
                      <SelectItem value="USD">USD ($)</SelectItem>
                      <SelectItem value="EUR">EUR (€)</SelectItem>
                      <SelectItem value="GBP">GBP (£)</SelectItem>
                      <SelectItem value="JPY">JPY (¥)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleSaveCompany} disabled={loading}>
              <Save className="mr-2 size-4" />
              Save Changes
            </Button>
          </div>
        </TabsContent>}

        {/* Profile Settings */}
        <TabsContent value="profile" className="space-y-6">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base">Personal Information</CardTitle>
              <CardDescription>Update your personal details and profile picture.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-6">
                <Avatar className="size-20 ring-2 ring-border">
                  <AvatarImage src={avatarUrl ?? undefined} alt={userSettings.name} />
                  <AvatarFallback className="bg-primary/10 text-primary text-xl font-medium">{userInitials}</AvatarFallback>
                </Avatar>
                <div className="space-y-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarChange}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={avatarUploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="mr-2 size-3" />
                    {avatarUploading ? "Uploading..." : "Change Photo"}
                  </Button>
                  <p className="text-xs text-muted-foreground">JPG, GIF or PNG. Max size 2MB.</p>
                </div>
              </div>

              <Separator />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="userName">Full Name</Label>
                  <Input
                    id="userName"
                    value={userSettings.name}
                    onChange={(e) => setUserSettings({ ...userSettings, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="userEmail">Email</Label>
                  <Input
                    id="userEmail"
                    type="email"
                    value={userSettings.email}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">Email cannot be changed.</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Role</Label>
                <Input value={userSettings.role} disabled className="bg-muted" />
                <p className="text-xs text-muted-foreground">Contact an administrator to change your role.</p>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleSaveProfile} disabled={loading}>
              <Save className="mr-2 size-4" />
              Save Changes
            </Button>
          </div>
        </TabsContent>

        {/* Notification Settings */}
        <TabsContent value="notifications" className="space-y-6">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base">Email Notifications</CardTitle>
              <CardDescription>Choose what notifications you want to receive via email.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Email Notifications</p>
                  <p className="text-xs text-muted-foreground">Receive notifications via email</p>
                </div>
                <Switch
                  checked={notifications.emailNotifications}
                  onCheckedChange={(v) => setNotifications({ ...notifications, emailNotifications: v })}
                />
              </div>
              <Separator />
              <div className="space-y-4">
                {[
                  { key: "leaveRequests", label: "Leave Requests", desc: "When employees submit leave requests" },
                  { key: "attendanceAlerts", label: "Attendance Alerts", desc: "When attendance anomalies are detected" },
                  { key: "payrollReminders", label: "Payroll Reminders", desc: "Monthly payroll processing reminders" },
                  { key: "newEmployees", label: "New Employees", desc: "When new employees are added" },
                  { key: "weeklyReports", label: "Weekly Reports", desc: "Weekly summary of HR activities" },
                ].map(({ key, label, desc }) => (
                  <div key={key} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{label}</p>
                      <p className="text-xs text-muted-foreground">{desc}</p>
                    </div>
                    <Switch
                      checked={notifications[key as keyof typeof notifications] as boolean}
                      onCheckedChange={(v) => setNotifications({ ...notifications, [key]: v })}
                      disabled={!notifications.emailNotifications}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <div className="flex justify-end">
            <Button onClick={handleSaveNotifications}>
              <Save className="mr-2 size-4" />
              Save Changes
            </Button>
          </div>
        </TabsContent>

        {/* Appearance Settings */}
        <TabsContent value="appearance" className="space-y-6">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base">Theme</CardTitle>
              <CardDescription>Customize the appearance of the application.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Color Theme</Label>
                <Select
                  value={appearance.theme}
                  onValueChange={(v) => {
                    setAppearance({ ...appearance, theme: v })
                    setTheme(v)
                  }}
                >
                  <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Separator />
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Collapsed Sidebar</p>
                    <p className="text-xs text-muted-foreground">Start with sidebar collapsed by default</p>
                  </div>
                  <Switch
                    checked={appearance.sidebarCollapsed}
                    onCheckedChange={(v) => setAppearance({ ...appearance, sidebarCollapsed: v })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Compact Mode</p>
                    <p className="text-xs text-muted-foreground">Reduce spacing for more content</p>
                  </div>
                  <Switch
                    checked={appearance.compactMode}
                    onCheckedChange={(v) => setAppearance({ ...appearance, compactMode: v })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
          <div className="flex justify-end">
            <Button onClick={handleSaveAppearance}>
              <Save className="mr-2 size-4" />
              Save Changes
            </Button>
          </div>
        </TabsContent>

        {/* Security Settings */}
        <TabsContent value="security" className="space-y-6">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base">Change Password</CardTitle>
              <CardDescription>Update your password to keep your account secure.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { id: "currentPassword", label: "Current Password", key: "current" as const },
                { id: "newPassword", label: "New Password", key: "newPass" as const },
                { id: "confirmPassword", label: "Confirm New Password", key: "confirm" as const },
              ].map(({ id, label, key }) => (
                <div key={id} className="space-y-2">
                  <Label htmlFor={id}>{label}</Label>
                  <div className="relative">
                    <Input
                      id={id}
                      type={showPasswords[key] ? "text" : "password"}
                      value={passwords[key]}
                      onChange={(e) => setPasswords({ ...passwords, [key]: e.target.value })}
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowPasswords(s => ({ ...s, [key]: !s[key] }))}
                    >
                      {showPasswords[key] ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </Button>
                  </div>
                </div>
              ))}
              <div className="flex justify-end pt-2">
                <Button onClick={handleChangePassword} disabled={loading}>
                  <Save className="mr-2 size-4" />
                  Update Password
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base">Two-Factor Authentication</CardTitle>
              <CardDescription>Add an extra layer of security to your account.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Enable 2FA</p>
                  <p className="text-xs text-muted-foreground">Use an authenticator app for login verification</p>
                </div>
                <Button variant="outline" disabled>Setup 2FA</Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 border-destructive/50">
            <CardHeader>
              <CardTitle className="text-base text-destructive">Danger Zone</CardTitle>
              <CardDescription>Irreversible and destructive actions.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Delete Account</p>
                  <p className="text-xs text-muted-foreground">Permanently delete your account and all data</p>
                </div>
                <Button variant="destructive" disabled>Delete Account</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  )
}

export default function SettingsPage() {
  return (
    <DashboardLayout>
      <SettingsPageContent />
    </DashboardLayout>
  )
}
