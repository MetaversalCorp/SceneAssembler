/*
** Copyright 2025 Metaversal Corporation.
** 
** Licensed under the Apache License, Version 2.0 (the "License"); 
** you may not use this file except in compliance with the License. 
** You may obtain a copy of the License at 
** 
**    https://www.apache.org/licenses/LICENSE-2.0
** 
** Unless required by applicable law or agreed to in writing, software 
** distributed under the License is distributed on an "AS IS" BASIS, 
** WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. 
** See the License for the specific language governing permissions and 
** limitations under the License.
** 
** SPDX-License-Identifier: Apache-2.0
*/

class MapUtil extends MV.MVMF.NOTIFICATION
{
   constructor ()
   {
      super ();
      
      this.nStack = 0;
   }

   async WaitForSingleObject (fnCond, interval)
   {
      return new Promise ((resolve) => {
         const check = () => {
            if (fnCond ())
            {
               resolve ();
            }
            else
            {
               setTimeout (check, interval);
            }
         };
         check ();
      })
   }

   RMCopy_Type (pJSON, pType, pRMPObjectSrc)
   {
      let bResult = true;

      if (pJSON.pType)
      {
         pType.bType     = pJSON.pType.bType;   
         pType.bSubtype  = pJSON.pType.bSubtype;
         pType.bFiction  = pJSON.pType.bFiction;
         pType.bMovable  = pJSON.pType.bMovable;

         if (pRMPObjectSrc &&
             pRMPObjectSrc.pType.bType     == pType.bType    &&
             pRMPObjectSrc.pType.bSubtype  == pType.bSubtype &&
             pRMPObjectSrc.pType.bFiction  == pType.bFiction &&
             pRMPObjectSrc.pType.bMovable  == pType.bMovable
         )
            bResult = false;
      }
      else bResult = false;

      return bResult;
   }

   RMCopy_Name (pJSON, pName, pRMPObjectSrc)
   {
      let bResult = true;

      if (pJSON.sName)
      {
         pName.wsRMPObjectId = pJSON.sName;

         if (pRMPObjectSrc &&
             pRMPObjectSrc.pName.wsRMPObjectId == pName.wsRMPObjectId
         )
            bResult = false;
      }
      else bResult = false;

      return bResult;
   }

   RMCopy_Owner (pJSON, pOwner, pRMPObjectSrc)
   {
      let bResult = true;

      if (pJSON.pOwner)
      {
         pOwner.twRPersonaIx = pJSON.pOwner.twRPersonaIx;

         if (pRMPObjectSrc &&
            pRMPObjectSrc.pOwner.twRPersonaIx == pOwner.twRPersonaIx
         )
            bResult = false;
      }
      else bResult = false;

      return bResult;
   }

   RMCopy_Resource (pResourceSrc, pJSON, pResource, pRMPObjectSrc)
   {
      let bResult = true;

      if (pJSON.pResource)
      {
         pResource.qwResource      = pResourceSrc.qwResource;
         pResource.sName           = pResourceSrc.sName;
         pResource.sReference      = pJSON.pResource.sReference;

         if (pRMPObjectSrc && 
             pRMPObjectSrc.pResource.qwResource == pResource.qwResource &&
             pRMPObjectSrc.pResource.sName      == pResource.sName &&
             pRMPObjectSrc.pResource.sReference == pResource.sReference
         )
            bResult = false;
      }
      else bResult = false;

      return bResult;
   }

   RMCopy_Transform (pJSON, pTransform, pRMPObjectSrc)
   {
      let bResult = true;

      if (pJSON.pTransform)
      {
         pTransform.vPosition.dX   = pJSON.pTransform.aPosition[0];
         pTransform.vPosition.dY   = pJSON.pTransform.aPosition[1];
         pTransform.vPosition.dZ   = pJSON.pTransform.aPosition[2];
                                 
         pTransform.qRotation.dX   = pJSON.pTransform.aRotation[0];
         pTransform.qRotation.dY   = pJSON.pTransform.aRotation[1];
         pTransform.qRotation.dZ   = pJSON.pTransform.aRotation[2];
         pTransform.qRotation.dW   = pJSON.pTransform.aRotation[3];
                                 
         pTransform.vScale.dX      = pJSON.pTransform.aScale[0];
         pTransform.vScale.dY      = pJSON.pTransform.aScale[1];
         pTransform.vScale.dZ      = pJSON.pTransform.aScale[2];

         if (pRMPObjectSrc &&
            pRMPObjectSrc.pTransform.vPosition.dX == pTransform.vPosition.dX &&
            pRMPObjectSrc.pTransform.vPosition.dY == pTransform.vPosition.dY &&
            pRMPObjectSrc.pTransform.vPosition.dZ == pTransform.vPosition.dZ &&
            pRMPObjectSrc.pTransform.qRotation.dX == pTransform.qRotation.dX &&
            pRMPObjectSrc.pTransform.qRotation.dY == pTransform.qRotation.dY &&
            pRMPObjectSrc.pTransform.qRotation.dZ == pTransform.qRotation.dZ &&
            pRMPObjectSrc.pTransform.qRotation.dW == pTransform.qRotation.dW &&
            pRMPObjectSrc.pTransform.vScale.dX    == pTransform.vScale.dX    &&
            pRMPObjectSrc.pTransform.vScale.dY    == pTransform.vScale.dY    &&
            pRMPObjectSrc.pTransform.vScale.dZ    == pTransform.vScale.dZ
         )
            bResult = false;
      }
      else bResult = false;

      return bResult;
   }

   RMCopy_Bound (pJSON, pBound, pRMPObjectSrc)
   {
      let bResult = true;

      if (pJSON.pTransform)
      {
         pBound.dX    = pJSON.aBound[0];
         pBound.dY    = pJSON.aBound[1];
         pBound.dZ    = pJSON.aBound[2];

         if (pRMPObjectSrc &&
            pRMPObjectSrc.pBound.dX == pBound.dX &&
            pRMPObjectSrc.pBound.dY == pBound.dY &&
            pRMPObjectSrc.pBound.dZ == pBound.dZ
         )
            bResult = false;
      }
      else bResult = false;

      return bResult;
   }

   onRSPEdit (pIAction, Param)
   {
      if (pIAction.pResponse.nResult == 0)
      {
      }
      else
      {
         this.nStack--;
         console.log ('ERROR: ' + pIAction.pResponse.nResult, pIAction);
      }
   }

   RMPEditType (pRMPObject, pRMPObjectJSON)
   {
      let pIAction = pRMPObject.Request ('TYPE');
      let Payload = pIAction.pRequest;

      if (this.RMCopy_Type (pRMPObjectJSON, Payload.pType, pRMPObject))
      {
         this.nStack++;
         pIAction.Send (this, this.onRSPEdit.bind (this));
      }
   }

   RMPEditName (pRMPObject, pRMPObjectJSON)
   {
      let pIAction = pRMPObject.Request ('NAME');
      let Payload = pIAction.pRequest;

      if (this.RMCopy_Name (pRMPObjectJSON, Payload.pName, pRMPObject))
      {
         this.nStack++;
         pIAction.Send (this, this.onRSPEdit.bind (this));
      }
   }

   RMPEditResource (pRMPObject, pRMPObjectJSON)
   {
      let pIAction = pRMPObject.Request ('RESOURCE');
      let Payload = pIAction.pRequest;

      if (this.RMCopy_Resource (pRMPObject.pResource, pRMPObjectJSON, Payload.pResource, pRMPObject))
      {
         this.nStack++;
         pIAction.Send (this, this.onRSPEdit.bind (this));
      }
   }

   RMPEditBound (pRMPObject, pRMPObjectJSON)
   {
      let pIAction = pRMPObject.Request ('BOUND');
      let Payload = pIAction.pRequest;

      if (this.RMCopy_Bound (pRMPObjectJSON, Payload.pBound, pRMPObject))
      {
         this.nStack++;
         pIAction.Send (this, this.onRSPEdit.bind (this));
      }
   }

   RMPEditTransform (pRMPObject, pRMPObjectJSON)
   {
      let pIAction = pRMPObject.Request ('TRANSFORM');
      let Payload = pIAction.pRequest;

      if (this.RMCopy_Transform (pRMPObjectJSON, Payload.pTransform, pRMPObject))
      {
         this.nStack++;
         pIAction.Send (this, this.onRSPEdit.bind (this));
      }
   }

   RMPEditAll (pRMPObject, pJSON)
   {
      this.RMPEditName      (pRMPObject, pJSON);
      this.RMPEditResource  (pRMPObject, pJSON);
      this.RMPEditBound     (pRMPObject, pJSON);
      this.RMPEditTransform (pRMPObject, pJSON);
   }
};
