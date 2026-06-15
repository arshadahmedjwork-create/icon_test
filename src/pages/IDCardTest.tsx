import React, { useState, useEffect } from 'react';
import { generateIdCardPDF, IDCardCoordinates } from '../services/idCardEngine';

export default function IDCardTest() {
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [coords, setCoords] = useState<IDCardCoordinates>({
        nameX: 100,
        nameY: 250,
        nameSize: 20,
        iconIdX: 100,
        iconIdY: 220,
        iconIdSize: 16,
        regIdX: 100,
        regIdY: 190,
        regIdSize: 14,
        qrX: 100,
        qrY: 50,
        qrSize: 80,
    });

    const details = {
        studentName: 'John Doe',
        iconId: 'MAD-26-001',
        registrationId: 'REG-12345',
        qrData: 'ICON ID: MAD-26-001'
    };

    const updatePdf = async () => {
        try {
            const pdfBytes = await generateIdCardPDF(details, coords);
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            setPdfUrl(url);
        } catch (error) {
            console.error("Error generating PDF:", error);
        }
    };

    useEffect(() => {
        updatePdf();
    }, [coords]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setCoords(prev => ({ ...prev, [name]: Number(value) }));
    };

    return (
        <div style={{ display: 'flex', height: '100vh', padding: '20px', fontFamily: 'sans-serif' }}>
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '20px' }}>
                <h2>ID Card Local Test</h2>
                <p>Adjust the coordinates to properly place the text on the PDF.</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    {Object.entries(coords).map(([key, value]) => (
                        <div key={key}>
                            <label style={{ display: 'block', fontSize: '12px' }}>{key}</label>
                            <input
                                type="number"
                                name={key}
                                value={value}
                                onChange={handleChange}
                                style={{ width: '100%', padding: '5px' }}
                            />
                        </div>
                    ))}
                </div>
                <button 
                    onClick={updatePdf}
                    style={{ marginTop: '20px', padding: '10px 20px', cursor: 'pointer' }}
                >
                    Refresh PDF
                </button>
            </div>
            <div style={{ flex: 2, border: '1px solid #ccc' }}>
                {pdfUrl ? (
                    <iframe src={pdfUrl} width="100%" height="100%" style={{ border: 'none' }} title="ID Card PDF" />
                ) : (
                    <div style={{ padding: '20px' }}>Loading PDF...</div>
                )}
            </div>
        </div>
    );
}
