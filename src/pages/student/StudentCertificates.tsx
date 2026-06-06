import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getCertificates } from "@/services/supabaseService";
import { Certificate } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Award, Download, AlertCircle } from "lucide-react";
import { generateSignedUrl } from "@/services/signedUrlHelper";

export default function StudentCertificates() {
    const { user } = useAuth();
    const [certificates, setCertificates] = useState<Certificate[]>([]);

    useEffect(() => {
        const loadCertificates = async () => {
            if (user) {
                const allCerts = await getCertificates();
                const myCerts = allCerts.filter(c => c.userId === user.id);
                setCertificates(myCerts);
            }
        };
        loadCertificates();
    }, [user]);

    if (certificates.length === 0) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="font-display text-2xl font-bold mb-1">My Certificates</h1>
                    <p className="text-sm text-muted-foreground">
                        View and download your earned certificates.
                    </p>
                </div>
                <Alert className="bg-blue-50 border-blue-200">
                    <AlertCircle className="h-4 w-4 text-blue-600" />
                    <AlertTitle className="text-blue-800">No Certificates Yet</AlertTitle>
                    <AlertDescription className="text-blue-700">
                        Certificates will be available here after your event participation or winning.
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="font-display text-2xl font-bold mb-1">My Certificates</h1>
                <p className="text-sm text-muted-foreground">
                    View and download your earned certificates.
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {certificates.map(cert => {
                    const isWinner = cert.type === "winner";
                    const isJudge = cert.type === "judge";
                    return (
                        <Card key={cert.id} className={isWinner ? "border-yellow-400 bg-yellow-50/10" : ""}>
                            <CardHeader>
                                <div className="flex justify-between items-start">
                                    <Award className={`w-8 h-8 ${isWinner ? "text-yellow-600" : isJudge ? "text-purple-600" : "text-blue-600"}`} />
                                    {isWinner && (
                                        <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
                                            Rank {cert.rank}
                                        </Badge>
                                    )}
                                </div>
                                <CardTitle className="mt-4 mb-1">
                                    {isWinner ? "Merit Certificate" : isJudge ? "Judge Certificate" : "Participation Certificate"}
                                </CardTitle>
                                <CardDescription>
                                    Issued on: {new Date(cert.generatedAt).toLocaleDateString()}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Button
                                    className="w-full"
                                    variant={isWinner ? "default" : "secondary"}
                                    onClick={() => {
                                        const signedUrl = generateSignedUrl(cert.id);
                                        window.open(signedUrl, "_blank");
                                    }}
                                >
                                    <Download className="w-4 h-4 mr-2" />
                                    Download PDF
                                </Button>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
