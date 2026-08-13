const fs = require('fs');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const QRCode = require('qrcode');

const rawData = `Name,Reg No
Priya lochana Gajendran,DG016
Hadis Atajafari,DG024
Dr. Ananthi S,DG026
Dr.A.R. AkbaR,DG029
Fayeez Abdullah,DG034
Dr Kaushal Kishore,DG035
Dr.Sasikala.C,DG038
Dr.R.BASKAR,DG041
Dr sivaranjani R,DG043
Dr Sakthivel Rajendran,DG046
Ravindra Kumar Jain,DG047
Malini raja,DG048
Rajasekaran M,DG049
DR.KADHIRESAN,DG050
Dr. Kirthana Devaji Rao,DG051
Deepalakshmi Divakar,DG052
Dr. Jones Jayabalan,DG054
Dr. Abirami. V,DG058
Uthejini,DG059
Dr. Bhavna Rao,DG060
Dr.M.A.Mejalla,DG069
Dr Soma Sindhuja K,DG075
Sowmiya Lingeshwaran,DG080
Dr.Vignesh durai,DG082
Dr.Krupa S,DG083
Dr Chitra R Chandran,DG085
Dr S Mitthra (alias) Malathi Suresh,DG087
Dr.Priya darshini,DG088
Dr.Revathi Miglani,DG089
Dr. Preethy. M,DG090
Dr.Gayathri M,DG091
Dr.ARTHI SRI A.S,DG092
Dr.YAMINI RAGHUPATHI,DG097
Dr Prabhalakshmi,DG099
Dr.A.Babu,DG0103
Dr.Bini Balakrishnan,DG0105
Dr Sakthivel Rajendran,DG0111
Dr.DEEPAK MOSES RAVINDRAN,DG0112
Dr.KARTHICK SOUNDARARAJAN,DG0113
Dr R Vindhiya surendhar,DG0115
Dr K PREMKUMAR,DG0116
Dr.sivasankari.s,DG0119
Dr.Chimera J,DG0120
Dr Thiyaneswaran N,DG0121
Dr.Aparna Ashok,DG0123
Dr Jeyapriya MP,DG0124
Dr.S.Anbu Meena,DG0126
Dr. Meenakshi Muthiah,DG0129
Pooja Mahalakshmi,DG0130
Dr.Rathi Vadhana,DG0135
Dr. Aishwarya,DG0138
Dr.GEETHA LAKSHMI,DG0139
Dr. G S V Nivashini,DG0140
"Dr.V.Poongodi,MDS,PhD",DG0143
Dr. Lekha A,DG0144
Dr. Swarna Priya. R,DG0149
Dr.Pragya S,DG0150
Dr.Deebalakshmi S,DG0152
Dr.Ramesh Kumar,DG001
Dr.Chandrasekar 13,DG002
Dr.Arun suraj,DG003
Dr.Dhanadhivya,DG004
Dr.S.Thanalekshmi,DG005
Dr.Jayachandra K.J,DG006
Dr.Priyadharshini P.S,DG007
Dr.Angel rathilin,DG008
Dr.V.Rathna prabhu,DG009
Dr.Meenakshi Muthukumar,DG010
Dr.T.Elangovan,DG011
Dr.M.S.Chandragupta,DG012
Dr.S.C.Ahila,DG013
Dr.J.Selvakumar,DG014
Dr.K.PranavBalaji,DG015
Dr.M.Venkat Prasad,DG016
Dr.Vidyaa Hari Iyer,DG017
Dr.B.Jayakrishna,DG018
Dr.R.Sridharan,DG019
Dr.M.S.Saravanakumar,DG020
Dr.Ganesh Puttu,DG021
Dr.P.Mahesh Kumar,DG022
Dr.S.Gopalkrishnan,DG023
Dr.Raghavendhar Karthick,DG024
Dr.Poornima,DG025
Dr.P.Janaradhanam,DG026
Dr.V.Rangarajan,DG027
Dr.Dayashree,DG028
Dr.Vanmathi,DG029
Dr.V.Balakumar,DG030
Dr.Sathish kumar,DG031
Dr.A.P.Maheshwar,DG032
Dr.Mohith Ashok,DG033
Dr.Shewta V,DG034
Dr.Arunmohzhi U,DG035
Dr G SURESH KUMAR,DG159
Dr.Rathinavelu,DG160
Dr Manikandan N,DG163
Dr.Archana Arun,DG036
Dr.V KANAGAPRIYAA,DG166
Dr.SATHIYAGOMATHI,DG167`;

async function generatePDFs() {
    const lines = rawData.split('\n').filter(line => line.trim() !== '' && !line.startsWith('Name,'));
    const delegates = lines.map(line => {
        // Handle potential quotes around names with commas
        let name = '';
        let regId = '';
        if (line.startsWith('"')) {
            const lastQuoteIndex = line.lastIndexOf('"');
            name = line.substring(1, lastQuoteIndex);
            regId = line.substring(lastQuoteIndex + 2).trim(); // Skip ", "
        } else {
            const parts = line.split(',');
            regId = parts.pop().trim();
            name = parts.join(',').trim();
        }
        return { name, regId };
    });

    const templatePath = 'a:/midas5/public/DELIGATES_ID_CARD.pdf';
    const existingPdfBytes = fs.readFileSync(templatePath);
    const pdfDoc = await PDFDocument.create();
    
    // Load existing document to copy from
    const templateDoc = await PDFDocument.load(existingPdfBytes);

    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

    for (let i = 0; i < delegates.length; i++) {
        const d = delegates[i];
        
        // Add a new page copying from the template
        const [copiedPage] = await pdfDoc.copyPages(templateDoc, [0]);
        pdfDoc.addPage(copiedPage);
        const page = pdfDoc.getPages()[i];
        
        const { width, height } = page.getSize();
        
        // The sidebar takes up about 22% of the width on the left.
        const sidebarWidth = width * 0.23;
        const contentWidth = width - sidebarWidth;
        const centerX = sidebarWidth + (contentWidth / 2);

        // Generate QR code (encode Name & RegNo)
        const qrText = d.name + ' | ' + d.regId;
        const qrDataUrl = await QRCode.toDataURL(qrText, { margin: 1 });
        const qrImageBytes = Buffer.from(qrDataUrl.split(',')[1], 'base64');
        const qrImage = await pdfDoc.embedPng(qrImageBytes);
        
        // Dimensions and coordinates
        let nameSize = 20;
        let nameTextWidth = font.widthOfTextAtSize(d.name, nameSize);
        const maxTextWidth = contentWidth - 20; // Ensure some padding
        if (nameTextWidth > maxTextWidth) {
            nameSize = nameSize * (maxTextWidth / nameTextWidth);
            nameTextWidth = font.widthOfTextAtSize(d.name, nameSize);
        }
        
        const regSize = 14;
        const regText = 'Reg No: ' + d.regId;
        const regTextWidth = regularFont.widthOfTextAtSize(regText, regSize);
        
        // Assuming height is around 400-600. Let's use percentages or proportional offsets
        // Middle of the space between header logo and footer text.
        const nameY = height * 0.56; 
        const regY = nameY - 20;
        
        const qrSize = 85;
        // Position QR below the Reg No
        const qrY = regY - qrSize - 10; 
        
        // Center text horizontally in the white area
        page.drawText(d.name, {
            x: centerX - (nameTextWidth / 2),
            y: nameY,
            size: nameSize,
            font: font,
            color: rgb(0, 0, 0),
        });

        page.drawText(regText, {
            x: centerX - (regTextWidth / 2),
            y: regY,
            size: regSize,
            font: regularFont,
            color: rgb(0.2, 0.2, 0.2),
        });
        
        // Center QR horizontally in the white area
        page.drawImage(qrImage, {
            x: centerX - (qrSize / 2),
            y: qrY,
            width: qrSize,
            height: qrSize,
        });
    }

    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync('a:/midas5/public/Delegates_ID_Cards_Final.pdf', pdfBytes);
    console.log('PDF generated successfully!');
}

generatePDFs().catch(err => console.error(err));
