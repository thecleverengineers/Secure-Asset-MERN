import { useEffect, useState, type FormEvent } from 'react';
import {
  Alert, Avatar, Box, Button, Chip, CircularProgress, Container, Grid, MenuItem,
  Paper, Rating, Stack, TextField, Typography,
} from '@mui/material';
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import LocationOnRounded from '@mui/icons-material/LocationOnRounded';
import RequestQuoteRounded from '@mui/icons-material/RequestQuoteRounded';
import VerifiedRounded from '@mui/icons-material/VerifiedRounded';
import { useLocation, useNavigate, useParams } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { getMyListings, getPublicSurveyor, requestSurveyorQuote } from '../services/api';

const money=(n:number)=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(n||0);

export default function SurveyorQuotePage(){
  const { id='' }=useParams();
  const navigate=useNavigate();
  const location=useLocation();
  const { user }=useAuth();
  const [surveyor,setSurveyor]=useState<any>();
  const [properties,setProperties]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [success,setSuccess]=useState('');
  const [request,setRequest]=useState({
    propertyId:'',
    title:'',
    surveyType:'land_measurement',
    landArea:'',
    measurementUnit:'sq_ft',
    purpose:'Property verification',
    preferredVisitDate:'',
    preferredCompletionDate:'',
    budgetMin:'',
    budgetMax:'',
    requestMessage:'',
  });

  useEffect(()=>{
    if(!user){
      navigate(`/login?next=${encodeURIComponent(location.pathname)}`,{replace:true});
      return;
    }
    let active=true;
    setLoading(true);
    setError('');
    Promise.all([getPublicSurveyor(id),getMyListings({limit:100})])
      .then(([surveyorResponse,propertyResponse])=>{
        if(!active)return;
        const selected=surveyorResponse.data;
        setSurveyor(selected);
        setProperties(propertyResponse.data||[]);
        setRequest((current)=>({
          ...current,
          title:current.title||`Property verification survey · ${selected?.name||'Surveyor'}`,
        }));
      })
      .catch((cause)=>active&&setError((cause as Error).message))
      .finally(()=>active&&setLoading(false));
    return()=>{active=false};
  },[id,user,location.pathname,navigate]);

  async function submit(event:FormEvent){
    event.preventDefault();
    if(!surveyor?.user)return;
    if(!request.propertyId||!request.landArea||!request.purpose.trim()){
      setError('Choose your property, enter its approximate size, and add the survey purpose.');
      return;
    }
    setBusy(true);
    setError('');
    setSuccess('');
    try{
      const response=await requestSurveyorQuote({
        surveyorId:surveyor.user,
        ...request,
        landArea:Number(request.landArea),
        budgetMin:Number(request.budgetMin||0),
        budgetMax:Number(request.budgetMax||0),
        requirements:['Property measurements and verification'],
        deliverables:['Measured survey report','Evidence photographs'],
      });
      setSuccess(response.message||'Quote request sent to the Surveyor.');
      window.scrollTo({top:0,behavior:'smooth'});
    }catch(cause){
      setError((cause as Error).message);
    }finally{
      setBusy(false);
    }
  }

  if(loading)return <Box sx={{minHeight:'70vh',display:'grid',placeItems:'center'}}><CircularProgress/></Box>;
  if(!user)return null;

  const serviceLocation=(surveyor?.serviceLocations||[])
    .map((item:any)=>[item.city,item.state].filter(Boolean).join(', '))
    .filter(Boolean)
    .slice(0,2)
    .join(' · ')||'Service area available';

  return <Box sx={{pt:{xs:9,md:11},pb:8,minHeight:'100vh',bgcolor:'#f5f9fc',fontFamily:"'Open Sans', sans-serif"}}>
    <Container maxWidth="lg">
      <Button startIcon={<ArrowBackRounded/>} onClick={()=>navigate('/surveyors')} sx={{mb:2,textTransform:'none'}}>Back to surveyors</Button>

      {success&&<Alert severity="success" onClose={()=>setSuccess('')} sx={{mb:2,borderRadius:2}}>{success}</Alert>}
      {error&&<Alert severity="error" onClose={()=>setError('')} sx={{mb:2,borderRadius:2}}>{error}</Alert>}

      <Grid container spacing={2.5}>
        <Grid size={{xs:12,md:4}}>
          <Paper elevation={0} sx={{p:2.5,border:'1px solid #dfe9f2',borderRadius:4,position:{md:'sticky'},top:{md:96}}}>
            <Stack alignItems="center" textAlign="center">
              <Avatar src={surveyor?.profilePhoto||surveyor?.agencyLogo} sx={{width:92,height:92,bgcolor:'#0b6175',fontSize:32}}>{surveyor?.name?.[0]}</Avatar>
              <Stack direction="row" spacing={.6} alignItems="center" sx={{mt:1.4}}>
                <Typography sx={{fontSize:17,fontWeight:600,color:'#17395c'}}>{surveyor?.name}</Typography>
                {surveyor?.verificationStatus==='verified'&&<VerifiedRounded sx={{fontSize:18,color:'#008f83'}}/>}
              </Stack>
              <Typography sx={{mt:.4,fontSize:11,color:'#7185a4'}}>{surveyor?.professionalTitle||surveyor?.profileType}</Typography>
              <Stack direction="row" spacing={.6} alignItems="center" sx={{mt:1}}>
                <Rating readOnly precision={.1} value={surveyor?.rating?.average||0} size="small"/>
                <Typography sx={{fontSize:10,color:'#7185a4'}}>{Number(surveyor?.rating?.average||0).toFixed(1)} ({surveyor?.rating?.count||0})</Typography>
              </Stack>
              <Stack direction="row" spacing={.5} alignItems="center" sx={{mt:1,color:'#617793'}}>
                <LocationOnRounded sx={{fontSize:15,color:'#008f83'}}/>
                <Typography sx={{fontSize:10}}>{serviceLocation}</Typography>
              </Stack>
              <Chip label={surveyor?.availability||'available'} size="small" color={surveyor?.availability==='available'?'success':'default'} sx={{mt:1.2,textTransform:'capitalize'}}/>
            </Stack>
            <Box sx={{mt:2,p:1.5,bgcolor:'#f7fafc',borderRadius:2}}>
              <Typography sx={{fontSize:9,color:'#8191a5',textTransform:'uppercase'}}>Services from</Typography>
              <Typography sx={{mt:.2,fontSize:20,fontWeight:600,color:'#17395c'}}>{money(surveyor?.startingPrice)}</Typography>
            </Box>
          </Paper>
        </Grid>

        <Grid size={{xs:12,md:8}}>
          <Paper component="form" onSubmit={submit} elevation={0} sx={{p:{xs:2,md:3},border:'1px solid #dfe9f2',borderRadius:4}}>
            <Stack direction="row" spacing={1.2} alignItems="center" sx={{mb:2.5}}>
              <Box sx={{width:38,height:38,borderRadius:2,bgcolor:'rgba(0,143,131,.09)',color:'#008f83',display:'grid',placeItems:'center'}}><RequestQuoteRounded/></Box>
              <Box>
                <Typography component="h1" sx={{fontSize:{xs:20,md:24},fontWeight:600,color:'#17395c'}}>Request Surveyor Quote</Typography>
                <Typography sx={{fontSize:10.5,color:'#7185a4'}}>Send your property survey requirements directly to {surveyor?.name}.</Typography>
              </Box>
            </Stack>

            <Grid container spacing={1.7}>
              <Grid size={12}>
                <TextField required select fullWidth size="small" label="Property to verify" value={request.propertyId} onChange={(e)=>setRequest({...request,propertyId:e.target.value})}>
                  {properties.map((property)=><MenuItem key={property._id} value={property._id}>{property.title||property.name||property.code||property.referenceNumber||property._id}</MenuItem>)}
                </TextField>
                {!properties.length&&<Typography sx={{mt:.7,fontSize:9.5,color:'#b26a21'}}>No property is available in your account. Add a property before requesting a quote.</Typography>}
              </Grid>

              <Grid size={{xs:12,md:8}}>
                <TextField required fullWidth size="small" label="Request title" value={request.title} onChange={(e)=>setRequest({...request,title:e.target.value})}/>
              </Grid>
              <Grid size={{xs:12,md:4}}>
                <TextField required select fullWidth size="small" label="Survey type" value={request.surveyType} onChange={(e)=>setRequest({...request,surveyType:e.target.value})}>
                  {['land_measurement','boundary_survey','building_survey','valuation','condition_survey','legal_verification','other'].map((item)=><MenuItem key={item} value={item}>{item.replaceAll('_',' ')}</MenuItem>)}
                </TextField>
              </Grid>

              <Grid size={{xs:12,md:7}}>
                <TextField required type="number" fullWidth size="small" label="Approximate property size" value={request.landArea} onChange={(e)=>setRequest({...request,landArea:e.target.value})}/>
              </Grid>
              <Grid size={{xs:12,md:5}}>
                <TextField select fullWidth size="small" label="Measurement unit" value={request.measurementUnit} onChange={(e)=>setRequest({...request,measurementUnit:e.target.value})}>
                  <MenuItem value="sq_ft">Square feet</MenuItem>
                  <MenuItem value="sq_metre">Square metre</MenuItem>
                </TextField>
              </Grid>

              <Grid size={12}>
                <TextField required fullWidth size="small" label="Survey purpose" value={request.purpose} onChange={(e)=>setRequest({...request,purpose:e.target.value})}/>
              </Grid>

              <Grid size={{xs:12,md:6}}>
                <TextField type="date" fullWidth size="small" label="Preferred visit date" InputLabelProps={{shrink:true}} value={request.preferredVisitDate} onChange={(e)=>setRequest({...request,preferredVisitDate:e.target.value})}/>
              </Grid>
              <Grid size={{xs:12,md:6}}>
                <TextField type="date" fullWidth size="small" label="Preferred report date" InputLabelProps={{shrink:true}} value={request.preferredCompletionDate} onChange={(e)=>setRequest({...request,preferredCompletionDate:e.target.value})}/>
              </Grid>

              <Grid size={{xs:12,md:6}}>
                <TextField type="number" fullWidth size="small" label="Budget minimum" value={request.budgetMin} onChange={(e)=>setRequest({...request,budgetMin:e.target.value})}/>
              </Grid>
              <Grid size={{xs:12,md:6}}>
                <TextField type="number" fullWidth size="small" label="Budget maximum" value={request.budgetMax} onChange={(e)=>setRequest({...request,budgetMax:e.target.value})}/>
              </Grid>

              <Grid size={12}>
                <TextField fullWidth multiline minRows={4} label="Request notes" placeholder="Add access instructions, site details, preferred timing, or any special survey requirements." value={request.requestMessage} onChange={(e)=>setRequest({...request,requestMessage:e.target.value})}/>
              </Grid>
            </Grid>

            <Stack direction={{xs:'column-reverse',sm:'row'}} justifyContent="flex-end" spacing={1} sx={{mt:3}}>
              <Button variant="outlined" onClick={()=>navigate(`/surveyors/${surveyor?.publicSlug||id}`)} disabled={busy} sx={{textTransform:'none'}}>View profile</Button>
              <Button type="submit" variant="contained" startIcon={<RequestQuoteRounded/>} disabled={busy||!properties.length||!request.propertyId||!request.landArea||!request.purpose.trim()} sx={{textTransform:'none',minWidth:160}}>
                {busy?'Sending…':'Send quote request'}
              </Button>
            </Stack>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  </Box>;
}
