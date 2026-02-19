import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Building2, MapPin, Phone, Mail, User,
    ArrowLeft, Globe, Briefcase, FileText,
    ShieldCheck, Network, Database
} from "lucide-react";
import { Account } from "@/services/accounts";
import { ContactManagement } from "./ContactManagement";
import { PotentialTracking } from "./PotentialTracking";

interface AccountDetailProps {
    account: Account;
    onBack: () => void;
    onEdit: () => void;
}

export const AccountDetail = ({ account, onBack, onEdit }: AccountDetailProps) => {
    const [activeTab, setActiveTab] = useState("overview");

    return (
        <div className="space-y-6">
            {/* Action Bar */}
            <div className="flex items-center justify-between">
                <Button variant="ghost" onClick={onBack} className="pl-0 hover:bg-transparent text-slate-500 hover:text-slate-900">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to Accounts
                </Button>
                <Button onClick={onEdit} className="bg-slate-900 hover:bg-slate-800 text-white rounded-none">
                    Edit Account Profile
                </Button>
            </div>

            {/* Header / Profile Summary */}
            <div className="flex flex-col md:flex-row gap-6 items-start pb-6 border-b border-slate-100">
                <div className="h-20 w-20 rounded-xl bg-slate-900 flex items-center justify-center text-white text-3xl font-bold shrink-0 shadow-lg">
                    {account.name.charAt(0)}
                </div>
                <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3">
                        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{account.name}</h1>
                        <Badge variant="outline" className="rounded-full bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-600 border-slate-200 px-3">
                            {(account.organizationType || "").replace(/_/g, " ")}
                        </Badge>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-slate-500">
                        {account.city && <div className="flex items-center gap-1.5"><MapPin className="h-4 w-4" />{account.city}, {account.state}</div>}
                        {account.website && <div className="flex items-center gap-1.5"><Globe className="h-4 w-4" />{account.website}</div>}
                        {account.accountLevel && <div className="flex items-center gap-1.5"><Network className="h-4 w-4" />{account.accountLevel} Level</div>}
                    </div>
                </div>
                <div className="flex flex-col items-end gap-2 text-right">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Account Type</span>
                    <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200 px-4 py-1.5 text-xs font-bold">
                        {account.accountType || "RETENTION"}
                    </Badge>
                </div>
            </div>

            {/* Tabbed Content */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="bg-transparent border-b border-slate-100 rounded-none w-full justify-start h-12 p-0 gap-6">
                    <TabsTrigger
                        value="overview"
                        className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none h-full px-1"
                    >
                        Detailed Overview
                    </TabsTrigger>
                    <TabsTrigger
                        value="contacts"
                        className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none h-full px-1"
                    >
                        Contacts
                    </TabsTrigger>
                    <TabsTrigger
                        value="potential"
                        className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none h-full px-1"
                    >
                        Market Potential
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Card className="col-span-2 shadow-sm border-slate-200">
                            <CardHeader>
                                <CardTitle className="text-base flex items-center gap-2">
                                    <FileText className="h-4 w-4 text-slate-400" /> Company Profile
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="grid grid-cols-2 gap-y-6">
                                <section className="space-y-1">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Legal Name</label>
                                    <p className="font-medium text-slate-900">{account.name}</p>
                                </section>
                                <section className="space-y-1">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Organization Type</label>
                                    <p className="font-medium text-slate-900">{account.organizationType}</p>
                                </section>
                                <section className="space-y-1">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Industry</label>
                                    <p className="font-medium text-slate-900">{account.industryCategory || "Not Specified"}</p>
                                    <p className="text-xs text-slate-500">{account.industrySubCategory}</p>
                                </section>
                                <section className="space-y-1">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Industry Size</label>
                                    <Badge variant="secondary" className="bg-slate-100 text-slate-700">{account.industrySize || "MEDIUM"}</Badge>
                                </section>
                                <section className="space-y-1 col-span-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Address</label>
                                    <p className="text-slate-900 leading-relaxed">
                                        {account.locality && `${account.locality}, `}
                                        {account.city}, {account.state}<br />
                                        {account.country}, {account.zip}
                                    </p>
                                </section>
                            </CardContent>
                        </Card>

                        <div className="space-y-6">
                            <Card className="shadow-sm border-slate-200">
                                <CardHeader>
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <ShieldCheck className="h-4 w-4 text-slate-400" /> Compliance Details
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="flex justify-between">
                                        <span className="text-sm text-slate-500">GSTIN</span>
                                        <span className="text-sm font-bold text-slate-900 font-mono">{account.gstin || "N/A"}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-sm text-slate-500">PAN</span>
                                        <span className="text-sm font-bold text-slate-900 font-mono">{account.panNumber || "N/A"}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-sm text-slate-500">PMS ID</span>
                                        <span className="text-sm font-bold text-slate-900">{account.pmsProfileId || "Not Linked"}</span>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="shadow-sm border-slate-200">
                                <CardHeader>
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <Briefcase className="h-4 w-4 text-slate-400" /> Sales Assignment
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-blue-600 uppercase">Primary Owner (PAM)</label>
                                        <p className="text-sm font-bold">{account.primaryAccountManager?.name || "Unassigned"}</p>
                                        <p className="text-xs text-slate-500">{account.primaryAccountManager?.city}</p>
                                    </div>
                                    {account.secondaryAccountManagers && account.secondaryAccountManagers.length > 0 && (
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase">Secondary Owners (SAM)</label>
                                            <ul className="text-xs space-y-1">
                                                {account.secondaryAccountManagers.map((sam, i) => (
                                                    <li key={i} className="font-medium">{sam.name} ({sam.city})</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="contacts" className="pt-6">
                    <ContactManagement accountId={account.id} />
                </TabsContent>

                <TabsContent value="potential" className="pt-6">
                    <PotentialTracking accountId={account.id} />
                </TabsContent>
            </Tabs>
        </div>
    );
};
