import { collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy, query } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import Loading from '../components/Loading';
import { auth, db, storage } from "../firebase/firebase";
import { showAlert } from "../features/alert/AlertSlice";
import { deleteObject, ref } from 'firebase/storage';
import DetailCard from './detailCard';

export default function AssignedView() {
  const params = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const userProfile = useSelector(state => state.user.profile);
  const [assignment, setAssignment] = useState(null);
  const [completions, setCompletions] = useState(null);
  const [isAssignmentExists, setIsAssignmentExists] = useState(true);

  const timestamp = (time) => {
    const fireBaseTime = new Date(time.seconds * 1000 + time.nanoseconds / 1000000,);
    const date = fireBaseTime.toDateString();
    const atTime = fireBaseTime.toLocaleTimeString();
    return date + " - " + atTime;
  }

  const deleteAssignmentDoc = () => {
    const documentRef = doc(db, "department", userProfile.branch, "assignments", params.id);
    deleteDoc(documentRef).then(() => {
      navigate('/');
    }).catch(() => {
      dispatch(showAlert({
        message: "Unable to delete this assignment.",
        type: "danger"
      }));
    });
  }

  const deleteAssigned = (e) => {
    if (assignment.attachment === null) {
      deleteAssignmentDoc();
    } else {
      let storageRef = null;

      if (assignment.attachmentType === 'img') {
        storageRef = ref(storage, `assignment/${params.id}/${auth.currentUser.uid}.png`);
      } else {
        storageRef = ref(storage, `assignment/${params.id}/${auth.currentUser.uid}.pdf`);
      }

      deleteObject(storageRef).then(() => {
        deleteAssignmentDoc();
      }).catch(() => {
        dispatch(showAlert({
          message: "Unable to delete this assignment.",
          type: "danger"
        }));
      });
    }
  }

  useEffect(() => {
    const fetchAssignment = async () => {
      const assignmentRef = doc(db, "department", userProfile.branch, "assignments", params.id);
      const assignmentSnap = await getDoc(assignmentRef);
      if (assignmentSnap.exists() && assignmentSnap.data().assignedBy === auth.currentUser.uid) {
        setAssignment(assignmentSnap.data());
      } else {
        setIsAssignmentExists(false);
      }
    }

    const fetchCompletions = async () => {
      const completedRef = collection(db, "department", userProfile.branch, "assignments", params.id, "completed");
      const completedQuery = query(completedRef, orderBy("rollno", "asc"), limit(100));
      const completedSnap = await getDocs(completedQuery);
      const completed = [];
      completedSnap.forEach((doc) => completed.push(doc.data()));
      setCompletions(completed);
    }

    if (userProfile !== null && (userProfile.role === "hod" || userProfile.role === "teacher") && assignment === null) {
      fetchAssignment();
      fetchCompletions();
    } else {
      setIsAssignmentExists(false);
    }
  }, [assignment, setAssignment, params.id, userProfile]);

  return (
    <>
      {
        userProfile === null && <Loading />
      }
      {
        userProfile
        &&
        <>
          {
            assignment === null && isAssignmentExists && <Loading />
          }
          {
            assignment === null && !isAssignmentExists && <Loading message="This Assignment may be removed or not found." />
          }
          {
            assignment !== null
            &&
            <>
              <div className='container mt-5'>
                <h4>Assignment | {assignment.subject}</h4>
                <span>{assignment.message}</span>
                <br />
                <br />
                <span>Assigned on - {timestamp(assignment.onDate)}</span>
                <br />
                <span>Submit on &nbsp;&nbsp;&nbsp;- {timestamp(assignment.outDate)}</span>
                <br />
                <br />

                {
                  assignment.attachment
                  &&
                  <>
                    <span><b>Attachment</b></span>
                    <div className="mt-3">
                      {
                        assignment.attachmentType === "img" &&
                        <img src={assignment.attachment} className="img-thumbnail" alt="attachment" />
                      }
                      {
                        assignment.attachmentType === "pdf" &&
                        <iframe title='PDF' src={assignment.attachment} className="w-100 vh-100"></iframe>
                      }
                    </div>
                  </>
                }

                <h6 className='mt-5'><b>Completed By - {assignment.branch.toUpperCase()} - {assignment.section} - {assignment.year} year [{completions === null ? '0' : completions.length} Student]</b></h6>

                {
                  completions &&
                  completions.map((e) => {
                    return <DetailCard key={e.uid} name={e.name} rollno={e.rollno} file={e.file}/>
                  })
                }

              </div>
              <div className='container mt-5 d-flex flex-column align-items-end'>
                <button className="btn btn-danger mt-3 mb-5" type="button" onClick={deleteAssigned}>Delete Assignment</button>
              </div>
            </>
          }
        </>
      }
    </>
  )
}
