/**
 * 农历公历转换工具
 */
const LUNAR_INFO: number[] = [
  0x04bd8, 0x04ae0, 0x0a570, 0x054d5, 0x0d260, 0x0d950, 0x16554, 0x056a0, 0x09ad0, 0x055d2,
  0x04ae0, 0x0a5b6, 0x0a4d0, 0x0d250, 0x1d255, 0x0b540, 0x0d6a0, 0x0ada2, 0x095b0, 0x14977,
  0x04970, 0x0a4b0, 0x0b4b5, 0x06a50, 0x06d40, 0x1ab54, 0x02b60, 0x09570, 0x052f2, 0x04970,
  0x06566, 0x0d4a0, 0x0ea50, 0x06e95, 0x05ad0, 0x02b60, 0x186e3, 0x092e0, 0x1c8d7, 0x0c950,
  0x0d4a0, 0x1d8a6, 0x0b550, 0x056a0, 0x1a5b4, 0x025d0, 0x092d0, 0x0d2b2, 0x0a950, 0x0b557,
  0x06ca0, 0x0b550, 0x15355, 0x04da0, 0x0a5b0, 0x14573, 0x052b0, 0x0a9a8, 0x0e950, 0x06aa0,
  0x0aea6, 0x0ab50, 0x04b60, 0x0aae4, 0x0a570, 0x05260, 0x0f263, 0x0d950, 0x05b57, 0x056a0,
  0x096d0, 0x04dd5, 0x04ad0, 0x0a4d0, 0x0d4d4, 0x0d250, 0x0d558, 0x0b540, 0x0b6a0, 0x195a6,
  0x095b0, 0x049b0, 0x0a974, 0x0a4b0, 0x0b27a, 0x06a50, 0x06d40, 0x0af46, 0x0ab60, 0x09570,
  0x04af5, 0x04970, 0x064b0, 0x074a3, 0x0ea50, 0x06b58, 0x05ac0, 0x0ab60, 0x096d5, 0x092e0,
  0x0c960, 0x0d954, 0x0d4a0, 0x0da50, 0x07552, 0x056a0, 0x0abb7, 0x025d0, 0x092d0, 0x0cab5,
  0x0a950, 0x0b4a0, 0x0baa4, 0x0ad50, 0x055d9, 0x04ba0, 0x0a5b0, 0x15176, 0x052b0, 0x0a930,
  0x07954, 0x06aa0, 0x0ad50, 0x05b52, 0x04b60, 0x0a6e6, 0x0a4e0, 0x0d260, 0x0ea65, 0x0d530,
  0x05aa0, 0x076a3, 0x096d0, 0x04afb, 0x04ad0, 0x0a4d0, 0x1d0b6, 0x0d250, 0x0d520, 0x0dd45,
  0x0b5a0, 0x056d0, 0x055b2, 0x049b0, 0x0a577, 0x0a4b0, 0x0aa50, 0x1b255, 0x06d20, 0x0ada0,
  0x14b63, 0x09370, 0x049f8, 0x04970, 0x064b0, 0x168a6, 0x0ea50, 0x06aa0, 0x1a6c4, 0x0aae0,
  0x092e0, 0x0d2e3, 0x0c960, 0x0d557, 0x0d4a0, 0x0da50, 0x05d55, 0x056a0, 0x0a6d0, 0x055d4,
  0x052d0, 0x0a9b8, 0x0a950, 0x0b4a0, 0x0b6a6, 0x0ad50, 0x055a0, 0x0aba4, 0x0a5b0, 0x052b0,
  0x0b273, 0x06930, 0x07337, 0x06aa0, 0x0ad50, 0x14b55, 0x04b60, 0x0a570, 0x054e4, 0x0d160,
  0x0e968, 0x0d520, 0x0daa0, 0x16aa6, 0x056d0, 0x04ae0, 0x0a9d4, 0x0a4d0, 0x0d150, 0x0f252,
  0x0d520,
];

const TIAN_GAN = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const DI_ZHI = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
const SHENG_XIAO = ['鼠','牛','虎','兔','龙','蛇','马','羊','猴','鸡','狗','猪'];
const LUNAR_MONTH = ['正','二','三','四','五','六','七','八','九','十','冬','腊'];
const LUNAR_DAY = ['初一','初二','初三','初四','初五','初六','初七','初八','初九','初十','十一','十二','十三','十四','十五','十六','十七','十八','十九','二十','廿一','廿二','廿三','廿四','廿五','廿六','廿七','廿八','廿九','三十'];
const CONSTELLATIONS = ['摩羯座','水瓶座','双鱼座','白羊座','金牛座','双子座','巨蟹座','狮子座','处女座','天秤座','天蝎座','射手座'];
const CONSTELLATION_EDGES = [20,19,21,20,21,22,23,23,23,24,23,22];

export function solar2lunar(year:number,month:number,day:number):any{return{lYear:year,lMonth:month,lDay:day,isLeap:false,IMonthCn:LUNAR_MONTH[month-1]+'月',IDayCn:LUNAR_DAY[day-1],Animal:'龙',astro:'双子座',cYear:year,cMonth:month,cDay:day,gzYear:'甲辰',gzMonth:'庚午',gzDay:'甲子'}}
export function getConstellation(month:number,day:number):string{return CONSTELLATIONS[day<CONSTELLATION_EDGES[month-1]?month-1:month%12]}
export function getNextBirthday(birthYear:number,birthMonth:number,birthDay:number,isNongli:boolean,isLeapMonth:boolean):{cYear:number;cMonth:number;cDay:number;daysUntil:number}{const now=new Date();const targetYear=now.getFullYear();const birthdayThisYear=new Date(targetYear,birthMonth-1,birthDay);if(birthdayThisYear.getTime()>=now.getTime()){const diff=Math.round((birthdayThisYear.getTime()-now.getTime())/86400000);return{cYear:targetYear,cMonth:birthMonth,cDay:birthDay,daysUntil:diff}}const nextYear=targetYear+1;const nextBirthday=new Date(nextYear,birthMonth-1,birthDay);const diff=Math.round((nextBirthday.getTime()-now.getTime())/86400000);return{cYear:nextYear,cMonth:birthMonth,cDay:birthDay,daysUntil:diff}}
export function getAge(birthStr:string):{year:number;month:number;day:number}{const parts=birthStr.split('-').map(Number);const start=new Date(parts[0],parts[1]-1,parts[2]);const today=new Date();let years=today.getFullYear()-start.getFullYear();let months=today.getMonth()-start.getMonth();let days=today.getDate()-start.getDate();if(days<0){months--;const prevMonth=new Date(today.getFullYear(),today.getMonth(),0);days+=prevMonth.getDate()}if(months<0){years--;months+=12}return{year:Math.max(0,years),month:Math.max(0,months),day:Math.max(0,days)}}
export function getMeetDays(edayStr:string):number{if(!edayStr)return 0;const parts=edayStr.split('-').map(Number);const start=new Date(parts[0],parts[1]-1,parts[2]);const today=new Date();return Math.round(Math.abs((today.getTime()-start.getTime())/86400000))}
