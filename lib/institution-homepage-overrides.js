const HOMEPAGES={
  'VAC-009':'http://www.kbic.co.kr',
  'VAC-040':'공식 홈페이지 공개 확인 안 됨',
  'VAC-062':'https://www.tapaps.com/',
  'VAC-068':'https://friendasset.com/',
  'VAC-073':'공식 홈페이지 공개 확인 안 됨',
  'ORG-044':'공식 홈페이지 공개 확인 안 됨',
};
function getInstitutionHomepageOverride(companyId){return HOMEPAGES[companyId]||null;}
module.exports={HOMEPAGES,getInstitutionHomepageOverride};
