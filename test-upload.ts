import { UploadService } from "./server/services/upload";

const testPSV = `ROLE|COACH_ID|NAME|MOBILE_NUMBER|DISCIPLINE|LOCATION|DISTRICT|HOTEL_ID|STADIUM|BOOKING_START_DATE|BOOKING_END_DATE|BOOKING_REFERENCE_NUMBER|NOTIFY_TRANSPORT_CONTACT|TRAVEL_POC_NAME|TRAVEL_POC_MOBILE|VENUE_POC_NAME|VENUE_POC_MOBILE
COACH|TEST_COA_001|Test Coach One|9876543201|Tennis|Chennai|Chennai|166543|Marina Stadium|01/10/2025|05/10/2025|REF001|9876543210|Travel POC|9876543211|Venue POC|9876543212
COACH|TEST_COA_002|Test Coach Two|9876543202|Football|Madurai|Madurai|166543|Central Stadium|02/10/2025|06/10/2025|REF002|9876543220|Travel POC2|9876543221|Venue POC2|9876543222`;

async function testUpload() {
  console.log('🧪 Testing coach user creation...');
  try {
    console.log('⏳ Starting batch upload...');
    const result = await UploadService.uploadCoachesOfficialsBatch(testPSV);
    console.log('📊 Upload result:', JSON.stringify(result, null, 2));
    console.log('✅ Test completed');
  } catch (error) {
    console.error('❌ Upload failed:', error);
  }
}

testUpload().then(() => process.exit(0)).catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});