const fs = require('fs');
const path = require('path');

function generateExcelDatabase() {
  const dataFile = path.join(__dirname, 'data.json');
  if (!fs.existsSync(dataFile)) {
    console.error('data.json not found');
    return;
  }

  const db = JSON.parse(fs.readFileSync(dataFile, 'utf8'));

  // Collect users
  const users = {};
  for (const [key, val] of Object.entries(db)) {
    if (key.startsWith('users/')) {
      users[val.username] = {
        username: val.username,
        createdAt: val.createdAt ? new Date(val.createdAt).toLocaleString() : 'N/A',
        confirmedPoints: 0,
        pendingPoints: 0,
        totalScans: 0,
        confirmedScans: 0,
        pendingScans: 0,
        rejectedScans: 0,
        lastScanTime: 'N/A',
        lastScanTimestamp: 0
      };
    }
  }

  // Collect wins/scans
  const scansList = [];
  for (const [key, val] of Object.entries(db)) {
    if (key.startsWith('wins/')) {
      const u = users[val.username] || {
        username: val.username,
        createdAt: 'N/A',
        confirmedPoints: 0,
        pendingPoints: 0,
        totalScans: 0,
        confirmedScans: 0,
        pendingScans: 0,
        rejectedScans: 0,
        lastScanTime: 'N/A',
        lastScanTimestamp: 0
      };
      users[val.username] = u;

      u.totalScans++;
      const pts = Number(val.points) || 0;
      if (val.status === 'confirmed') {
        u.confirmedPoints += pts;
        u.confirmedScans++;
      } else if (val.status === 'pending') {
        u.pendingPoints += pts;
        u.pendingScans++;
      } else {
        u.rejectedScans++;
      }

      const scanTime = val.createdAt ? new Date(val.createdAt).toLocaleString() : 'N/A';
      if (val.createdAt && val.createdAt > u.lastScanTimestamp) {
        u.lastScanTimestamp = val.createdAt;
        u.lastScanTime = scanTime;
      }

      scansList.push({
        id: val.id || key.replace('wins/', ''),
        username: val.username,
        challenge: val.challenge || 'N/A',
        points: pts,
        status: (val.status || 'pending').toUpperCase(),
        date: scanTime,
        timestamp: val.createdAt || 0
      });
    }
  }

  // Sort participants by confirmed points descending
  const sortedParticipants = Object.values(users).sort((a, b) => b.confirmedPoints - a.confirmedPoints);

  // Assign sequential rank 1, 2, 3...
  sortedParticipants.forEach((p, idx) => {
    p.rank = idx + 1;
  });

  // Sort scans by timestamp descending (most recent first)
  scansList.sort((a, b) => b.timestamp - a.timestamp);

  // 1. Generate Participants CSV (UTF-8 with BOM for Excel compatibility)
  const bom = '\uFEFF';
  let participantsCsv = bom + [
    'Rank',
    'Username',
    'Confirmed Points (Leaderboard)',
    'Pending Points (Awaiting Approval)',
    'Total Scans',
    'Confirmed Scans',
    'Pending Scans',
    'Rejected Scans',
    'Registered At',
    'Last Activity'
  ].map(h => `"${h}"`).join(',') + '\r\n';

  for (const p of sortedParticipants) {
    participantsCsv += [
      p.rank,
      `"${p.username}"`,
      p.confirmedPoints,
      p.pendingPoints,
      p.totalScans,
      p.confirmedScans,
      p.pendingScans,
      p.rejectedScans,
      `"${p.createdAt}"`,
      `"${p.lastScanTime}"`
    ].join(',') + '\r\n';
  }

  const pCsvPath = path.join(__dirname, 'participants_database.csv');
  fs.writeFileSync(pCsvPath, participantsCsv, 'utf8');

  // Also copy to public/ so it can be directly downloaded via browser
  const publicCsvPath = path.join(__dirname, 'public', 'participants_database.csv');
  fs.writeFileSync(publicCsvPath, participantsCsv, 'utf8');

  // 2. Generate Detailed Scans Log CSV
  let scansCsv = bom + [
    'Scan ID',
    'Participant',
    'Challenge / Game Name',
    'Points',
    'Approval Status',
    'Date & Time'
  ].map(h => `"${h}"`).join(',') + '\r\n';

  for (const s of scansList) {
    scansCsv += [
      `"${s.id}"`,
      `"${s.username}"`,
      `"${s.challenge}"`,
      s.points,
      `"${s.status}"`,
      `"${s.date}"`
    ].join(',') + '\r\n';
  }

  const scansCsvPath = path.join(__dirname, 'game_scans_log.csv');
  fs.writeFileSync(scansCsvPath, scansCsv, 'utf8');

  const publicScansCsvPath = path.join(__dirname, 'public', 'game_scans_log.csv');
  fs.writeFileSync(publicScansCsvPath, scansCsv, 'utf8');

  // 3. Generate XML-based Multi-Sheet Excel Workbook (.xls)
  // This opens directly in Microsoft Excel with formatted columns, colors, and sheets!
  let xmlExcel = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Font ss:FontName="Segoe UI" ss:Size="11" ss:Color="#000000"/>
  </Style>
  <Style ss:ID="Header">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#79AE44"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Size="11" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#171A1F" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="RankTop">
   <Alignment ss:Horizontal="Center"/>
   <Font ss:FontName="Segoe UI" ss:Bold="1" ss:Color="#79AE44"/>
  </Style>
  <Style ss:ID="Centered">
   <Alignment ss:Horizontal="Center"/>
  </Style>
  <Style ss:ID="BoldText">
   <Font ss:FontName="Segoe UI" ss:Bold="1"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Participants Database">
  <Table>
   <Column ss:Width="50"/>
   <Column ss:Width="160"/>
   <Column ss:Width="150"/>
   <Column ss:Width="150"/>
   <Column ss:Width="90"/>
   <Column ss:Width="110"/>
   <Column ss:Width="110"/>
   <Column ss:Width="170"/>
   <Column ss:Width="170"/>
   <Row ss:Height="26">
    <Cell ss:StyleID="Header"><Data ss:Type="String">Rank</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Participant Name</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Confirmed Points</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Pending Points</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Total Scans</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Confirmed Scans</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Pending Scans</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Registration Date</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Last Activity</Data></Cell>
   </Row>`;

  for (const p of sortedParticipants) {
    xmlExcel += `
   <Row ss:Height="20">
    <Cell ss:StyleID="${p.rank <= 3 ? 'RankTop' : 'Centered'}"><Data ss:Type="Number">${p.rank}</Data></Cell>
    <Cell ss:StyleID="BoldText"><Data ss:Type="String">${escapeXml(p.username)}</Data></Cell>
    <Cell ss:StyleID="Centered"><Data ss:Type="Number">${p.confirmedPoints}</Data></Cell>
    <Cell ss:StyleID="Centered"><Data ss:Type="Number">${p.pendingPoints}</Data></Cell>
    <Cell ss:StyleID="Centered"><Data ss:Type="Number">${p.totalScans}</Data></Cell>
    <Cell ss:StyleID="Centered"><Data ss:Type="Number">${p.confirmedScans}</Data></Cell>
    <Cell ss:StyleID="Centered"><Data ss:Type="Number">${p.pendingScans}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(p.createdAt)}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(p.lastScanTime)}</Data></Cell>
   </Row>`;
  }

  xmlExcel += `
  </Table>
 </Worksheet>
 <Worksheet ss:Name="Scans &amp; Wins Log">
  <Table>
   <Column ss:Width="200"/>
   <Column ss:Width="140"/>
   <Column ss:Width="180"/>
   <Column ss:Width="80"/>
   <Column ss:Width="110"/>
   <Column ss:Width="170"/>
   <Row ss:Height="26">
    <Cell ss:StyleID="Header"><Data ss:Type="String">Scan ID</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Participant</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Challenge Name</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Points</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Status</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Date &amp; Time</Data></Cell>
   </Row>`;

  for (const s of scansList) {
    xmlExcel += `
   <Row ss:Height="20">
    <Cell><Data ss:Type="String">${escapeXml(s.id)}</Data></Cell>
    <Cell ss:StyleID="BoldText"><Data ss:Type="String">${escapeXml(s.username)}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(s.challenge)}</Data></Cell>
    <Cell ss:StyleID="Centered"><Data ss:Type="Number">${s.points}</Data></Cell>
    <Cell ss:StyleID="Centered"><Data ss:Type="String">${escapeXml(s.status)}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXml(s.date)}</Data></Cell>
   </Row>`;
  }

  xmlExcel += `
  </Table>
 </Worksheet>
</Workbook>`;

  const excelXlsPath = path.join(__dirname, 'participants_database.xls');
  fs.writeFileSync(excelXlsPath, xmlExcel, 'utf8');

  const publicExcelXlsPath = path.join(__dirname, 'public', 'participants_database.xls');
  fs.writeFileSync(publicExcelXlsPath, xmlExcel, 'utf8');

  console.log(`Generated database files successfully:`);
  console.log(` - ${pCsvPath}`);
  console.log(` - ${scansCsvPath}`);
  console.log(` - ${excelXlsPath}`);
}

function escapeXml(unsafe) {
  if (unsafe === undefined || unsafe === null) return '';
  return String(unsafe).replace(/[<>&'"]/g, c => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
    }
  });
}

generateExcelDatabase();
module.exports = { generateExcelDatabase };
